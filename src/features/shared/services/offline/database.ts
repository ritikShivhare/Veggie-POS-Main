/**
 * Veggie POS - Dexie.js + IndexedDB Offline Storage Layer
 * 
 * Provides high-performance, transactional, tenant-scoped offline storage for:
 * 1. menuItems
 * 2. ingredients
 * 3. recipes
 * 4. staff
 * 5. orders
 * 6. orderItems
 * 7. customers
 * 8. shifts
 * 9. settings
 * 10. outbox (Durable queue for offline mutations)
 * 11. syncMetadata (Checkpoint and version tracking)
 * 
 * Includes Dexie version migrations.
 */

import Dexie, { Table } from "dexie";
import {
  OfflineMenuItem,
  OfflineIngredient,
  OfflineRecipe,
  OfflineStaff,
  OfflineOrder,
  OfflineOrderItem,
  OfflineCustomer,
  OfflineShift,
  OfflineSetting,
  OfflineOutboxItem,
  OfflineSyncMetadata
} from "./types";
import { getDeviceId } from "./deviceId";

export class VeggiePOSLocalDatabase extends Dexie {
  menuItems!: Table<OfflineMenuItem, string>;
  ingredients!: Table<OfflineIngredient, string>;
  recipes!: Table<OfflineRecipe, string>;
  staff!: Table<OfflineStaff, string>;
  orders!: Table<OfflineOrder, string>;
  orderItems!: Table<OfflineOrderItem, string>;
  customers!: Table<OfflineCustomer, string>;
  shifts!: Table<OfflineShift, string>;
  settings!: Table<OfflineSetting, string>;
  outbox!: Table<OfflineOutboxItem, string>;
  syncMetadata!: Table<OfflineSyncMetadata, string>;

  constructor(databaseName: string = "VeggiePOS_IndexedDB") {
    super(databaseName);

    // =========================================================================
    // Migration Version 1: Initial schema defining all 11 required stores
    // =========================================================================
    this.version(1).stores({
      menuItems: "id, tenantId, branchId, category, isAvailable, updatedAt, [tenantId+id], [tenantId+category], [tenantId+updatedAt]",
      ingredients: "id, tenantId, branchId, currentStock, minStock, updatedAt, [tenantId+id], [tenantId+updatedAt]",
      recipes: "id, tenantId, menuItemId, updatedAt, [tenantId+id], [tenantId+menuItemId]",
      staff: "id, tenantId, branchId, role, updatedAt, [tenantId+id], [tenantId+role]",
      orders: "id, tenantId, branchId, status, date, cashierId, updatedAt, [tenantId+id], [tenantId+status], [tenantId+date], [tenantId+updatedAt]",
      orderItems: "id, tenantId, orderId, menuItemId, updatedAt, [tenantId+id], [tenantId+orderId]",
      customers: "id, tenantId, phone, name, updatedAt, [tenantId+id], [tenantId+phone]",
      shifts: "id, tenantId, staffId, status, startTime, updatedAt, [tenantId+id], [tenantId+status], [tenantId+staffId]",
      settings: "id, tenantId, key, updatedAt, [tenantId+id], [tenantId+key]",
      outbox: "id, tenantId, status, action, clientTimestamp, updatedAt, [tenantId+id], [tenantId+status], [tenantId+clientTimestamp]",
      syncMetadata: "id, tenantId, sliceName, updatedAt, [tenantId+id], [tenantId+sliceName]"
    });

    // =========================================================================
    // Migration Version 2: Added 'version' indexing & upgrade hook enforcing
    // tenantId, branchId, deviceId, updatedAt, version on all historic records
    // =========================================================================
    this.version(2).stores({
      menuItems: "id, tenantId, branchId, category, isAvailable, updatedAt, version, [tenantId+id], [tenantId+category], [tenantId+updatedAt]",
      ingredients: "id, tenantId, branchId, currentStock, minStock, updatedAt, version, [tenantId+id], [tenantId+updatedAt]",
      recipes: "id, tenantId, menuItemId, updatedAt, version, [tenantId+id], [tenantId+menuItemId]",
      staff: "id, tenantId, branchId, role, updatedAt, version, [tenantId+id], [tenantId+role]",
      orders: "id, tenantId, branchId, status, date, cashierId, updatedAt, version, [tenantId+id], [tenantId+status], [tenantId+date], [tenantId+updatedAt]",
      orderItems: "id, tenantId, orderId, menuItemId, updatedAt, version, [tenantId+id], [tenantId+orderId]",
      customers: "id, tenantId, phone, name, updatedAt, version, [tenantId+id], [tenantId+phone]",
      shifts: "id, tenantId, staffId, status, startTime, updatedAt, version, [tenantId+id], [tenantId+status], [tenantId+staffId]",
      settings: "id, tenantId, key, updatedAt, version, [tenantId+id], [tenantId+key]",
      outbox: "id, tenantId, status, action, clientTimestamp, updatedAt, version, [tenantId+id], [tenantId+status], [tenantId+clientTimestamp]",
      syncMetadata: "id, tenantId, sliceName, updatedAt, version, [tenantId+id], [tenantId+sliceName]"
    }).upgrade(async (tx) => {
      const defaultDeviceId = getDeviceId();
      const now = new Date().toISOString();

      const storeNames = [
        "menuItems", "ingredients", "recipes", "staff",
        "orders", "orderItems", "customers", "shifts",
        "settings", "outbox", "syncMetadata"
      ];

      for (const name of storeNames) {
        try {
          const table = tx.table(name);
          await table.toCollection().modify((record: any) => {
            if (!record.tenantId) record.tenantId = "veg-main-001";
            if (!record.branchId) record.branchId = "main";
            if (!record.deviceId) record.deviceId = defaultDeviceId;
            if (!record.updatedAt) record.updatedAt = now;
            if (typeof record.version !== "number") record.version = 1;
          });
        } catch (upgradeErr) {
          console.warn(`[LocalDB Migration V2] Upgrade warning on store ${name}:`, upgradeErr);
        }
      }
    });

    // =========================================================================
    // Migration Version 3: Durable Outbox schema upgrade with operationId,
    // entityType, entityId, operationType, createdAt, retryCount, nextRetryAt
    // =========================================================================
    this.version(3).stores({
      menuItems: "id, tenantId, branchId, category, isAvailable, updatedAt, version, [tenantId+id], [tenantId+category], [tenantId+updatedAt]",
      ingredients: "id, tenantId, branchId, currentStock, minStock, updatedAt, version, [tenantId+id], [tenantId+updatedAt]",
      recipes: "id, tenantId, menuItemId, updatedAt, version, [tenantId+id], [tenantId+menuItemId]",
      staff: "id, tenantId, branchId, role, updatedAt, version, [tenantId+id], [tenantId+role]",
      orders: "id, tenantId, branchId, status, date, cashierId, updatedAt, version, [tenantId+id], [tenantId+status], [tenantId+date], [tenantId+updatedAt]",
      orderItems: "id, tenantId, orderId, menuItemId, updatedAt, version, [tenantId+id], [tenantId+orderId]",
      customers: "id, tenantId, phone, name, updatedAt, version, [tenantId+id], [tenantId+phone]",
      shifts: "id, tenantId, staffId, status, startTime, updatedAt, version, [tenantId+id], [tenantId+status], [tenantId+staffId]",
      settings: "id, tenantId, key, updatedAt, version, [tenantId+id], [tenantId+key]",
      outbox: "id, operationId, tenantId, status, entityType, entityId, operationType, createdAt, clientTimestamp, nextRetryAt, updatedAt, version, [tenantId+status], [tenantId+clientTimestamp]",
      syncMetadata: "id, tenantId, sliceName, updatedAt, version, [tenantId+id], [tenantId+sliceName]"
    }).upgrade(async (tx) => {
      try {
        const outboxTable = tx.table("outbox");
        await outboxTable.toCollection().modify((record: any) => {
          if (!record.operationId) record.operationId = record.id;
          if (!record.createdAt) record.createdAt = record.updatedAt || new Date().toISOString();
          if (!record.entityType) record.entityType = "order";
          if (!record.entityId) record.entityId = record.id;
          if (!record.operationType) record.operationType = record.action || "CREATE";
          if (typeof record.retryCount !== "number") record.retryCount = 0;
          if (!record.status) record.status = "pending";
          if (!record.nextRetryAt) record.nextRetryAt = Date.now();
        });
      } catch (err) {
        console.warn("[LocalDB Migration V3] Upgrade warning on outbox store:", err);
      }
    });
  }
}

// Global Singleton Dexie Database Instance
export const localDb = new VeggiePOSLocalDatabase();
