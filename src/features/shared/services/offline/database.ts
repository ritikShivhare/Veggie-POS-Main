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
    // Dexie cannot change an existing primary key. Copy into new stores first,
    // then remove the legacy stores in v5; IDs remain unchanged for the server.
    this.version(4).stores({
      menuItems_v4: "[tenantId+id], id, tenantId, branchId, category, isAvailable, updatedAt, version, [tenantId+category], [tenantId+updatedAt], [tenantId+id]",
      ingredients_v4: "[tenantId+id], id, tenantId, branchId, currentStock, minStock, updatedAt, version, [tenantId+updatedAt], [tenantId+id]",
      recipes_v4: "[tenantId+id], id, tenantId, branchId, menuItemId, updatedAt, version, [tenantId+menuItemId], [tenantId+id]",
      staff_v4: "[tenantId+id], id, tenantId, branchId, role, updatedAt, version, [tenantId+role], [tenantId+id]",
      orders_v4: "[tenantId+id], id, tenantId, branchId, status, date, cashierId, updatedAt, version, [tenantId+status], [tenantId+date], [tenantId+id]",
      orderItems_v4: "[tenantId+id], id, tenantId, branchId, orderId, menuItemId, updatedAt, version, [tenantId+orderId], [tenantId+id]",
      customers_v4: "[tenantId+id], id, tenantId, branchId, phone, name, updatedAt, version, [tenantId+phone], [tenantId+id]",
      shifts_v4: "[tenantId+id], id, tenantId, branchId, staffId, status, startTime, updatedAt, version, [tenantId+status], [tenantId+id]",
      settings_v4: "[tenantId+id], id, tenantId, branchId, key, updatedAt, version, [tenantId+key], [tenantId+id]",
      outbox_v4: "[tenantId+id], id, tenantId, branchId, operationId, status, entityType, entityId, operationType, createdAt, clientTimestamp, nextRetryAt, updatedAt, version, [tenantId+status], [tenantId+id]",
      syncMetadata_v4: "[tenantId+id], id, tenantId, branchId, sliceName, updatedAt, version, [tenantId+sliceName], [tenantId+id]"
    }).upgrade(async tx => {
      for (const name of ['menuItems', 'ingredients', 'recipes', 'staff', 'orders', 'orderItems', 'customers', 'shifts', 'settings', 'outbox', 'syncMetadata']) {
        const rows = await tx.table(name).toArray();
        const scoped = rows.filter((r:any)=>r.tenantId && r.id && !(name==='settings' && ['managerPin','pin','password','passwordHash','slackWebhookUrl','sentryDsn','emailAlertAddress'].includes(r.key))).map((r:any)=> {
          const credentials=['pin','password','passwordHash','managerPin','sessionId'];
          let removed=false;
          const safe=JSON.parse(JSON.stringify(r,(key,value)=>{if(credentials.includes(key)){removed=true;return undefined;}return value;}));
          if(name==='outbox' && removed) {safe.status='validation_error';safe.lastError='Legacy credentials were removed. Review and reauthorize this command.';}
          return safe;
        });
        if (scoped.length) await tx.table(name+"_v4").bulkPut(scoped);
      }
    });
    this.version(5).stores({
      menuItems: null,
      ingredients: null,
      recipes: null,
      staff: null,
      orders: null,
      orderItems: null,
      customers: null,
      shifts: null,
      settings: null,
      outbox: null,
      syncMetadata: null
    });
    this.menuItems = this.table("menuItems_v4");
    this.ingredients = this.table("ingredients_v4");
    this.recipes = this.table("recipes_v4");
    this.staff = this.table("staff_v4");
    this.orders = this.table("orders_v4");
    this.orderItems = this.table("orderItems_v4");
    this.customers = this.table("customers_v4");
    this.shifts = this.table("shifts_v4");
    this.settings = this.table("settings_v4");
    this.outbox = this.table("outbox_v4");
    this.syncMetadata = this.table("syncMetadata_v4");

  }
}

// Global Singleton Dexie Database Instance
export const localDb = new VeggiePOSLocalDatabase();
