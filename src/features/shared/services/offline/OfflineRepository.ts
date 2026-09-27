/**
 * Veggie POS - Tenant-Scoped Offline Repository
 * 
 * Provides transactional, strongly-typed access to IndexedDB stores.
 * Enforces mandatory tenantId, branchId, deviceId, updatedAt, and version on all records.
 */

import { localDb, VeggiePOSLocalDatabase } from "./database";
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
  OfflineSyncMetadata,
  OutboxActionType,
  OutboxStatus
} from "./types";
import { getDeviceId, getBranchId } from "./deviceId";

export class OfflineRepository {
  public db: VeggiePOSLocalDatabase;

  constructor(customDb?: VeggiePOSLocalDatabase) {
    this.db = customDb || localDb;
  }

  /**
   * Enriches an entity with mandatory tenant, branch, device, and audit timestamps.
   */
  private enrichRecord<T extends { id: string; version?: number }>(
    tenantId: string,
    record: T,
    explicitBranchId?: string
  ): T & {
    tenantId: string;
    branchId: string;
    deviceId: string;
    updatedAt: string;
    version: number;
  } {
    const now = new Date().toISOString();
    return {
      ...record,
      tenantId,
      branchId: explicitBranchId || (record as any).branchId || getBranchId(tenantId),
      deviceId: (record as any).deviceId || getDeviceId(),
      updatedAt: (record as any).updatedAt || now,
      version: typeof record.version === "number" ? record.version : 1
    };
  }

  // =========================================================================
  // Menu Items Store
  // =========================================================================
  public async getMenuItems(tenantId: string): Promise<OfflineMenuItem[]> {
    return this.db.menuItems.where("tenantId").equals(tenantId).toArray();
  }

  public async saveMenuItems(tenantId: string, items: any[]): Promise<void> {
    const enriched = items.map((item) => this.enrichRecord(tenantId, item));
    await this.db.transaction("rw", this.db.menuItems, async () => {
      // Clear old tenant items and bulk put fresh state
      await this.db.menuItems.where("tenantId").equals(tenantId).delete();
      await this.db.menuItems.bulkPut(enriched);
    });
  }

  public async putMenuItem(tenantId: string, item: any): Promise<void> {
    const enriched = this.enrichRecord(tenantId, item);
    await this.db.menuItems.put(enriched);
  }

  // =========================================================================
  // Ingredients Store
  // =========================================================================
  public async getIngredients(tenantId: string): Promise<OfflineIngredient[]> {
    return this.db.ingredients.where("tenantId").equals(tenantId).toArray();
  }

  public async saveIngredients(tenantId: string, items: any[]): Promise<void> {
    const enriched = items.map((item) => this.enrichRecord(tenantId, item));
    await this.db.transaction("rw", this.db.ingredients, async () => {
      await this.db.ingredients.where("tenantId").equals(tenantId).delete();
      await this.db.ingredients.bulkPut(enriched);
    });
  }

  public async putIngredient(tenantId: string, item: any): Promise<void> {
    const enriched = this.enrichRecord(tenantId, item);
    await this.db.ingredients.put(enriched);
  }

  // =========================================================================
  // Recipes Store
  // =========================================================================
  public async getRecipes(tenantId: string): Promise<OfflineRecipe[]> {
    return this.db.recipes.where("tenantId").equals(tenantId).toArray();
  }

  public async saveRecipes(tenantId: string, items: any[]): Promise<void> {
    const enriched = items.map((item) => {
      const record = {
        ...item,
        id: item.id || `rec_${item.menuItemId || Math.random().toString(36).substring(2, 9)}`
      };
      return this.enrichRecord(tenantId, record);
    });
    await this.db.transaction("rw", this.db.recipes, async () => {
      await this.db.recipes.where("tenantId").equals(tenantId).delete();
      await this.db.recipes.bulkPut(enriched);
    });
  }

  // =========================================================================
  // Staff Store
  // =========================================================================
  public async getStaff(tenantId: string): Promise<OfflineStaff[]> {
    return this.db.staff.where("tenantId").equals(tenantId).toArray();
  }

  public async saveStaff(tenantId: string, items: any[]): Promise<void> {
    const enriched = items.map((item) => this.enrichRecord(tenantId, item));
    await this.db.transaction("rw", this.db.staff, async () => {
      await this.db.staff.where("tenantId").equals(tenantId).delete();
      await this.db.staff.bulkPut(enriched);
    });
  }

  // =========================================================================
  // Orders & Order Items Stores
  // =========================================================================
  public async getOrders(tenantId: string): Promise<OfflineOrder[]> {
    return this.db.orders.where("tenantId").equals(tenantId).toArray();
  }

  public async getOrderItems(tenantId: string, orderId?: string): Promise<OfflineOrderItem[]> {
    if (orderId) {
      return this.db.orderItems
        .where("[tenantId+orderId]")
        .equals([tenantId, orderId])
        .toArray();
    }
    return this.db.orderItems.where("tenantId").equals(tenantId).toArray();
  }

  public async saveOrders(tenantId: string, items: any[]): Promise<void> {
    const enrichedOrders = items.map((item) => this.enrichRecord(tenantId, item));
    
    // Extract and normalize order items
    const allOrderItems: OfflineOrderItem[] = [];
    for (const order of items) {
      if (Array.isArray(order.items)) {
        order.items.forEach((ci: any, index: number) => {
          const mItem = ci.menuItem || {};
          allOrderItems.push(
            this.enrichRecord(tenantId, {
              id: ci.id || `oi_${order.id}_${index}`,
              orderId: order.id,
              menuItemId: mItem.id,
              name: mItem.name || "Item",
              quantity: ci.quantity || 1,
              unitPrice: mItem.price || 0,
              subtotal: (mItem.price || 0) * (ci.quantity || 1),
              notes: ci.note,
              version: 1
            })
          );
        });
      }
    }

    await this.db.transaction("rw", [this.db.orders, this.db.orderItems], async () => {
      await this.db.orders.where("tenantId").equals(tenantId).delete();
      await this.db.orders.bulkPut(enrichedOrders);

      if (allOrderItems.length > 0) {
        await this.db.orderItems.where("tenantId").equals(tenantId).delete();
        await this.db.orderItems.bulkPut(allOrderItems);
      }
    });
  }

  public async putOrder(tenantId: string, order: any): Promise<void> {
    const enrichedOrder = this.enrichRecord(tenantId, order);
    const orderItems: OfflineOrderItem[] = [];
    if (Array.isArray(order.items)) {
      order.items.forEach((ci: any, index: number) => {
        const mItem = ci.menuItem || {};
        orderItems.push(
          this.enrichRecord(tenantId, {
            id: ci.id || `oi_${order.id}_${index}`,
            orderId: order.id,
            menuItemId: mItem.id,
            name: mItem.name || "Item",
            quantity: ci.quantity || 1,
            unitPrice: mItem.price || 0,
            subtotal: (mItem.price || 0) * (ci.quantity || 1),
            notes: ci.note,
            version: 1
          })
        );
      });
    }

    await this.db.transaction("rw", [this.db.orders, this.db.orderItems], async () => {
      await this.db.orders.put(enrichedOrder);
      if (orderItems.length > 0) {
        await this.db.orderItems.bulkPut(orderItems);
      }
    });
  }

  // =========================================================================
  // Customers Store
  // =========================================================================
  public async getCustomers(tenantId: string): Promise<OfflineCustomer[]> {
    return this.db.customers.where("tenantId").equals(tenantId).toArray();
  }

  public async saveCustomers(tenantId: string, items: any[]): Promise<void> {
    const enriched = items.map((item) => this.enrichRecord(tenantId, item));
    await this.db.transaction("rw", this.db.customers, async () => {
      await this.db.customers.where("tenantId").equals(tenantId).delete();
      await this.db.customers.bulkPut(enriched);
    });
  }

  public async putCustomer(tenantId: string, customer: any): Promise<void> {
    const enriched = this.enrichRecord(tenantId, customer);
    await this.db.customers.put(enriched);
  }

  // =========================================================================
  // Shifts Store
  // =========================================================================
  public async getShifts(tenantId: string): Promise<OfflineShift[]> {
    return this.db.shifts.where("tenantId").equals(tenantId).toArray();
  }

  public async saveShifts(tenantId: string, items: any[]): Promise<void> {
    const enriched = items.map((item) => this.enrichRecord(tenantId, item));
    await this.db.transaction("rw", this.db.shifts, async () => {
      await this.db.shifts.where("tenantId").equals(tenantId).delete();
      await this.db.shifts.bulkPut(enriched);
    });
  }

  public async putShift(tenantId: string, shift: any): Promise<void> {
    const enriched = this.enrichRecord(tenantId, shift);
    await this.db.shifts.put(enriched);
  }

  // =========================================================================
  // Settings Store
  // =========================================================================
  public async getSettings(tenantId: string): Promise<Record<string, any>> {
    const records = await this.db.settings.where("tenantId").equals(tenantId).toArray();
    const result: Record<string, any> = {};
    for (const rec of records) {
      result[rec.key] = rec.value;
    }
    return result;
  }

  public async saveSettings(tenantId: string, settingsObj: Record<string, any>): Promise<void> {
    const records: OfflineSetting[] = Object.keys(settingsObj).map((key) => {
      return this.enrichRecord(tenantId, {
        id: `${tenantId}_${key}`,
        key,
        value: settingsObj[key],
        version: 1
      });
    });

    await this.db.transaction("rw", this.db.settings, async () => {
      await this.db.settings.where("tenantId").equals(tenantId).delete();
      await this.db.settings.bulkPut(records);
    });
  }

  public async putRecipe(tenantId: string, recipe: any): Promise<void> {
    const enriched = this.enrichRecord(tenantId, recipe);
    await this.db.recipes.put(enriched);
  }

  public async putStaff(tenantId: string, staff: any): Promise<void> {
    const enriched = this.enrichRecord(tenantId, staff);
    await this.db.staff.put(enriched);
  }

  public async putSetting(tenantId: string, key: string, value: any): Promise<void> {
    const enriched = this.enrichRecord(tenantId, {
      id: `${tenantId}_${key}`,
      key,
      value,
      version: 1
    });
    await this.db.settings.put(enriched);
  }

  // =========================================================================
  // Outbox Store (Durable Offline Queue)
  // Every mutation creates an outbox operation containing:
  // operationId, tenantId, branchId, deviceId, entityType, entityId,
  // operationType, payload, createdAt, retryCount, status.
  // Uses client-generated UUIDs and reuses server idempotency keys.
  // =========================================================================
  public async enqueueOutbox(
    tenantId: string,
    actionOrOptions: OutboxActionType | string | {
      entityType: string;
      entityId: string;
      operationType: string;
      payload: any;
      endpoint: string;
      method: "POST" | "PUT" | "PATCH" | "DELETE";
      idempotencyKey?: string;
      operationId?: string;
      branchId?: string;
      deviceId?: string;
      action?: string;
    },
    endpoint?: string,
    method?: "POST" | "PUT" | "PATCH" | "DELETE",
    payload?: any,
    idempotencyKey?: string
  ): Promise<OfflineOutboxItem> {
    const now = Date.now();
    const isoNow = new Date().toISOString();

    let entityType = "order";
    let entityId = "";
    let operationType = "CREATE";
    let actualPayload = payload;
    let actualEndpoint = endpoint || "/api/orders";
    let actualMethod = method || "POST";
    let actualAction = typeof actionOrOptions === "string" ? actionOrOptions : "CREATE_ORDER";
    let explicitOpId: string | undefined;
    let explicitBranchId: string | undefined;
    let explicitDeviceId: string | undefined;
    let explicitIdempotencyKey: string | undefined = idempotencyKey;

    if (typeof actionOrOptions === "object" && actionOrOptions !== null) {
      entityType = actionOrOptions.entityType;
      entityId = actionOrOptions.entityId;
      operationType = actionOrOptions.operationType;
      actualPayload = actionOrOptions.payload;
      actualEndpoint = actionOrOptions.endpoint;
      actualMethod = actionOrOptions.method;
      actualAction = actionOrOptions.action || `${operationType}_${entityType.toUpperCase()}`;
      explicitOpId = actionOrOptions.operationId;
      explicitBranchId = actionOrOptions.branchId;
      explicitDeviceId = actionOrOptions.deviceId;
      explicitIdempotencyKey = actionOrOptions.idempotencyKey;
    } else {
      // Legacy signature fallback
      actualAction = actionOrOptions as string;
      if (actualAction.includes("ORDER")) entityType = "order";
      else if (actualAction.includes("INVENTORY")) entityType = "inventory";
      else if (actualAction.includes("CUSTOMER")) entityType = "customer";
      else if (actualAction.includes("SHIFT")) entityType = "shift";
      else if (actualAction.includes("PURCHASE")) entityType = "purchase";
      else entityType = "sync";

      entityId = actualPayload?.id || `ent_${now}_${Math.random().toString(36).substring(2, 7)}`;
      operationType = actualMethod === "POST" ? "CREATE" : actualMethod === "DELETE" ? "DELETE" : "UPDATE";
    }

    // Client-generated UUID for the outbox operation
    const operationId = explicitOpId || (
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `op_${now}_${Math.random().toString(36).substring(2, 9)}`
    );

    // Reuse server idempotency-key system: deterministic key per entity mutation
    const ik = explicitIdempotencyKey || `ik_${entityType}_${entityId || operationId}`;

    const outboxItem: OfflineOutboxItem = {
      id: operationId,
      operationId,
      tenantId,
      branchId: explicitBranchId || getBranchId(tenantId),
      deviceId: explicitDeviceId || getDeviceId(),
      entityType,
      entityId: entityId || operationId,
      operationType,
      payload: actualPayload,
      createdAt: isoNow,
      retryCount: 0,
      status: "pending",
      endpoint: actualEndpoint,
      method: actualMethod,
      idempotencyKey: ik,
      nextRetryAt: now,
      clientTimestamp: now,
      action: actualAction,
      updatedAt: isoNow,
      version: 1
    };

    await this.db.outbox.put(outboxItem);
    return outboxItem;
  }

  /**
   * Retrieves pending and retryable failed outbox operations for a tenant.
   * Only returns operations whose exponential backoff delay (nextRetryAt) has expired.
   */
  public async getPendingOutbox(tenantId: string): Promise<OfflineOutboxItem[]> {
    const now = Date.now();
    const items = await this.db.outbox
      .where("tenantId")
      .equals(tenantId)
      .toArray();

    return items
      .filter((item) => {
        if (item.status === "completed" || item.status === "SYNCED") return false;
        if (item.status === "conflict" || item.status === "auth_error" || item.status === "validation_error") return false;
        // status is "pending", "failed", or "syncing" (recovered after crash/reload)
        if (item.nextRetryAt && item.nextRetryAt > now) {
          return false; // Still within exponential backoff delay
        }
        return true;
      })
      .sort((a, b) => (a.clientTimestamp || 0) - (b.clientTimestamp || 0));
  }

  public async getAllOutbox(tenantId: string): Promise<OfflineOutboxItem[]> {
    return this.db.outbox.where("tenantId").equals(tenantId).toArray();
  }

  public async updateOutboxStatus(
    id: string,
    status: OutboxStatus,
    lastError?: string
  ): Promise<void> {
    const existing = await this.db.outbox.get(id);
    if (!existing) return;

    await this.db.outbox.update(id, {
      status,
      lastError,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Updates a local entity with the canonical version and attributes returned by the server.
   * Also updates the slice's syncMetadata in IndexedDB.
   */
  public async updateEntityWithCanonical(
    tenantId: string,
    entityType: string,
    entityId: string,
    canonicalData: any
  ): Promise<void> {
    if (!canonicalData || typeof canonicalData !== "object") return;

    try {
      switch (entityType) {
        case "order": {
          const existing = await this.db.orders.get(entityId);
          if (existing) {
            await this.db.orders.update(entityId, {
              ...existing,
              ...canonicalData,
              version: canonicalData.version || (existing.version || 1) + 1,
              updatedAt: canonicalData.updated_at || canonicalData.updatedAt || new Date().toISOString()
            });
          } else {
            await this.putOrder(tenantId, canonicalData);
          }
          break;
        }
        case "payment": {
          const existing = await this.db.orders.get(entityId);
          if (existing) {
            await this.db.orders.update(entityId, {
              ...existing,
              status: canonicalData.status || existing.status,
              paymentMethod: canonicalData.paymentMethod || existing.paymentMethod,
              paidAt: canonicalData.paidAt || existing.paidAt,
              version: canonicalData.version || (existing.version || 1) + 1,
              updatedAt: canonicalData.updated_at || canonicalData.updatedAt || new Date().toISOString()
            });
          } else {
            await this.putOrder(tenantId, canonicalData);
          }
          break;
        }
        case "customer": {
          const existing = await this.db.customers.get(entityId);
          if (existing) {
            await this.db.customers.update(entityId, {
              ...existing,
              ...canonicalData,
              version: canonicalData.version || (existing.version || 1) + 1,
              updatedAt: canonicalData.updated_at || canonicalData.updatedAt || new Date().toISOString()
            });
          } else {
            await this.putCustomer(tenantId, canonicalData);
          }
          break;
        }
        case "shift": {
          const existing = await this.db.shifts.get(entityId);
          if (existing) {
            await this.db.shifts.update(entityId, {
              ...existing,
              ...canonicalData,
              version: canonicalData.version || (existing.version || 1) + 1,
              updatedAt: canonicalData.updated_at || canonicalData.updatedAt || new Date().toISOString()
            });
          } else {
            await this.putShift(tenantId, canonicalData);
          }
          break;
        }
        case "inventory":
        case "ingredient": {
          if (Array.isArray(canonicalData)) {
            await this.saveIngredients(tenantId, canonicalData);
          } else if (canonicalData.id) {
            await this.putIngredient(tenantId, canonicalData);
          }
          break;
        }
        case "menu":
        case "menuItem": {
          if (Array.isArray(canonicalData)) {
            await this.saveMenuItems(tenantId, canonicalData);
          } else if (canonicalData.id) {
            await this.putMenuItem(tenantId, canonicalData);
          }
          break;
        }
        case "recipe": {
          if (Array.isArray(canonicalData)) {
            await this.saveRecipes(tenantId, canonicalData);
          } else if (canonicalData.id) {
            await this.putRecipe(tenantId, canonicalData);
          }
          break;
        }
        case "staff": {
          if (Array.isArray(canonicalData)) {
            await this.saveStaff(tenantId, canonicalData);
          } else if (canonicalData.id) {
            await this.putStaff(tenantId, canonicalData);
          }
          break;
        }
        case "settings": {
          if (canonicalData.key) {
            await this.putSetting(tenantId, canonicalData.key, canonicalData.value);
          }
          break;
        }
        default:
          break;
      }

      // Update syncMetadata for this slice in IndexedDB
      const sliceName = this.resolveSliceName(entityType);
      const canonicalVersion = typeof canonicalData.version === "number" ? canonicalData.version : 1;
      await this.updateSyncMetadata(tenantId, sliceName, {
        serverVersion: canonicalVersion,
        clientVersion: canonicalVersion,
        status: "synced"
      });
    } catch (err) {
      console.warn(`[OfflineRepository] Failed to update local entity ${entityType} [${entityId}] with canonical:`, err);
    }
  }

  private resolveSliceName(entityType: string): string {
    switch (entityType) {
      case "order":
      case "payment":
        return "orders";
      case "inventory":
      case "ingredient":
        return "ingredients";
      case "recipe":
        return "recipes";
      case "customer":
        return "customers";
      case "shift":
        return "shifts";
      case "menu":
      case "menuItem":
        return "menuItems";
      case "staff":
        return "staff";
      case "settings":
        return "settings";
      default:
        return entityType.endsWith("s") ? entityType : `${entityType}s`;
    }
  }

  public async getOutboxItem(id: string): Promise<OfflineOutboxItem | undefined> {
    return this.db.outbox.get(id);
  }

  /**
   * Records a failed outbox mutation with exponential backoff and jitter.
   * Prevents duplicate requests and thundering herds upon reconnection.
   */
  public async recordOutboxFailure(
    id: string,
    lastError: string,
    statusOverride: OutboxStatus = "failed",
    delayMs?: number
  ): Promise<void> {
    const existing = await this.db.outbox.get(id);
    if (!existing) return;

    const newRetryCount = (existing.retryCount || 0) + 1;
    let nextRetryAt: number;

    if (delayMs !== undefined) {
      nextRetryAt = Date.now() + delayMs;
    } else {
      // Exponential backoff: base 1s, 2s, 4s, 8s, 16s, 32s, max 60s
      // with 0-500ms jitter to prevent synchronized retry bursts
      const baseDelayMs = 1000;
      const maxDelayMs = 60000;
      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, newRetryCount));
      const jitter = Math.floor(Math.random() * 500);
      nextRetryAt = Date.now() + exponentialDelay + jitter;
    }

    await this.db.outbox.update(id, {
      status: statusOverride,
      lastError,
      retryCount: newRetryCount,
      nextRetryAt,
      updatedAt: new Date().toISOString()
    });
  }

  public async removeOutboxItem(id: string): Promise<void> {
    await this.db.outbox.delete(id);
  }

  // =========================================================================
  // POS Write Operations (Committed to IndexedDB first, non-blocking UI)
  // =========================================================================

  /**
   * Records a new order offline:
   * 1. Commits order and order items directly to IndexedDB
   * 2. Enqueues an outbox operation with client UUID and idempotency key
   * 3. UI does NOT wait for the cloud API
   */
  public async recordOrderOffline(tenantId: string, order: any): Promise<OfflineOutboxItem> {
    // 1. Commit to IndexedDB first
    await this.putOrder(tenantId, order);

    // 2. Enqueue in durable outbox
    const idempotencyKey = `ik_order_${order.id}`;
    return this.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: order.id,
      operationType: "CREATE",
      payload: order,
      endpoint: "/api/orders",
      method: "POST",
      idempotencyKey
    });
  }

  /**
   * Records an order payment / status update offline:
   * 1. Commits status change directly to IndexedDB
   * 2. Enqueues an outbox operation with idempotency key
   */
  public async recordPaymentOffline(
    tenantId: string,
    orderId: string,
    updateData: { status: string; paymentMethod?: string; paidAt?: string }
  ): Promise<OfflineOutboxItem> {
    // 1. Update in local IndexedDB
    const existing = await this.db.orders.get(orderId);
    if (existing) {
      await this.db.orders.update(orderId, {
        ...updateData,
        updatedAt: new Date().toISOString()
      });
    }

    // 2. Enqueue in durable outbox
    const idempotencyKey = `ik_pay_${orderId}_${updateData.status || "Completed"}`;
    return this.enqueueOutbox(tenantId, {
      entityType: "payment",
      entityId: orderId,
      operationType: "UPDATE",
      payload: updateData,
      endpoint: `/api/orders/${encodeURIComponent(orderId)}`,
      method: "PUT",
      idempotencyKey
    });
  }

  /**
   * Records a new or updated customer offline:
   * 1. Commits customer to IndexedDB
   * 2. Enqueues an outbox operation with idempotency key
   */
  public async recordCustomerOffline(tenantId: string, customer: any): Promise<OfflineOutboxItem> {
    await this.putCustomer(tenantId, customer);

    const idempotencyKey = `ik_cust_${customer.id}`;
    return this.enqueueOutbox(tenantId, {
      entityType: "customer",
      entityId: customer.id,
      operationType: "CREATE",
      payload: customer,
      endpoint: "/api/customers",
      method: "POST",
      idempotencyKey
    });
  }

  /**
   * Records ingredient inventory deductions / adjustments offline:
   * 1. Commits updated stock levels to IndexedDB
   * 2. Enqueues an outbox operation with idempotency key
   */
  public async recordInventoryOffline(tenantId: string, ingredients: any[]): Promise<OfflineOutboxItem> {
    await this.saveIngredients(tenantId, ingredients);

    const idempotencyKey = `ik_inv_${tenantId}_${Date.now()}`;
    return this.enqueueOutbox(tenantId, {
      entityType: "inventory",
      entityId: ingredients[0]?.id || `inv_${Date.now()}`,
      operationType: "UPDATE",
      payload: ingredients,
      endpoint: "/api/ingredients/bulk",
      method: "POST",
      idempotencyKey
    });
  }

  /**
   * Records a purchase invoice offline:
   * 1. Commits purchase and enqueues outbox operation
   */
  public async recordPurchaseOffline(tenantId: string, purchase: any): Promise<OfflineOutboxItem> {
    const idempotencyKey = `ik_purch_${purchase.id}`;
    return this.enqueueOutbox(tenantId, {
      entityType: "purchase",
      entityId: purchase.id,
      operationType: "CREATE",
      payload: purchase,
      endpoint: "/api/purchases",
      method: "POST",
      idempotencyKey
    });
  }

  /**
   * Records shift details offline:
   * 1. Commits shift to IndexedDB
   * 2. Enqueues an outbox operation with idempotency key
   */
  public async recordShiftOffline(tenantId: string, shift: any): Promise<OfflineOutboxItem> {
    await this.putShift(tenantId, shift);

    const idempotencyKey = `ik_shift_${shift.id}`;
    return this.enqueueOutbox(tenantId, {
      entityType: "shift",
      entityId: shift.id,
      operationType: "CREATE",
      payload: shift,
      endpoint: "/api/shifts",
      method: "POST",
      idempotencyKey
    });
  }

  // =========================================================================
  // Sync Metadata Store
  // =========================================================================
  public async getSyncMetadata(
    tenantId: string,
    sliceName: string
  ): Promise<OfflineSyncMetadata | undefined> {
    const id = `${tenantId}_${sliceName}`;
    return this.db.syncMetadata.get(id);
  }

  public async getAllSyncMetadata(tenantId: string): Promise<OfflineSyncMetadata[]> {
    return this.db.syncMetadata.where("tenantId").equals(tenantId).toArray();
  }

  public async updateSyncMetadata(
    tenantId: string,
    sliceName: string,
    meta: {
      serverVersion?: number;
      clientVersion?: number;
      status?: "synced" | "pending" | "conflict";
    }
  ): Promise<void> {
    const id = `${tenantId}_${sliceName}`;
    const existing = await this.db.syncMetadata.get(id);
    const now = new Date().toISOString();

    const record: OfflineSyncMetadata = this.enrichRecord(tenantId, {
      id,
      sliceName,
      lastSyncedAt: now,
      serverVersion: meta.serverVersion ?? existing?.serverVersion ?? 1,
      clientVersion: meta.clientVersion ?? existing?.clientVersion ?? 1,
      status: meta.status ?? existing?.status ?? "synced",
      version: (existing?.version ?? 0) + 1
    });

    await this.db.syncMetadata.put(record);
  }

  // =========================================================================
  // Complete Full State Tenant Save & Load
  // =========================================================================
  public async saveFullTenantState(
    tenantId: string,
    data: {
      menuItems?: any[];
      ingredients?: any[];
      recipes?: any[];
      staffList?: any[];
      orders?: any[];
      customers?: any[];
      shifts?: any[];
      settings?: any;
    }
  ): Promise<void> {
    if (data.menuItems) await this.saveMenuItems(tenantId, data.menuItems);
    if (data.ingredients) await this.saveIngredients(tenantId, data.ingredients);
    if (data.recipes) await this.saveRecipes(tenantId, data.recipes);
    if (data.staffList) await this.saveStaff(tenantId, data.staffList);
    if (data.orders) await this.saveOrders(tenantId, data.orders);
    if (data.customers) await this.saveCustomers(tenantId, data.customers);
    if (data.shifts) await this.saveShifts(tenantId, data.shifts);
    if (data.settings) await this.saveSettings(tenantId, data.settings);

    await this.updateSyncMetadata(tenantId, "all", { status: "synced" });
  }

  public async getFullTenantState(tenantId: string): Promise<{
    menuItems: OfflineMenuItem[];
    ingredients: OfflineIngredient[];
    recipes: OfflineRecipe[];
    staffList: OfflineStaff[];
    orders: OfflineOrder[];
    customers: OfflineCustomer[];
    shifts: OfflineShift[];
    settings: Record<string, any>;
  }> {
    const [
      menuItems,
      ingredients,
      recipes,
      staffList,
      orders,
      customers,
      shifts,
      settings
    ] = await Promise.all([
      this.getMenuItems(tenantId),
      this.getIngredients(tenantId),
      this.getRecipes(tenantId),
      this.getStaff(tenantId),
      this.getOrders(tenantId),
      this.getCustomers(tenantId),
      this.getShifts(tenantId),
      this.getSettings(tenantId)
    ]);

    return {
      menuItems,
      ingredients,
      recipes,
      staffList,
      orders,
      customers,
      shifts,
      settings
    };
  }

  /**
   * Purge tenant offline storage completely
   */
  public async clearTenantOfflineData(tenantId: string): Promise<void> {
    await this.db.transaction(
      "rw",
      [
        this.db.menuItems,
        this.db.ingredients,
        this.db.recipes,
        this.db.staff,
        this.db.orders,
        this.db.orderItems,
        this.db.customers,
        this.db.shifts,
        this.db.settings,
        this.db.outbox,
        this.db.syncMetadata
      ],
      async () => {
        await Promise.all([
          this.db.menuItems.where("tenantId").equals(tenantId).delete(),
          this.db.ingredients.where("tenantId").equals(tenantId).delete(),
          this.db.recipes.where("tenantId").equals(tenantId).delete(),
          this.db.staff.where("tenantId").equals(tenantId).delete(),
          this.db.orders.where("tenantId").equals(tenantId).delete(),
          this.db.orderItems.where("tenantId").equals(tenantId).delete(),
          this.db.customers.where("tenantId").equals(tenantId).delete(),
          this.db.shifts.where("tenantId").equals(tenantId).delete(),
          this.db.settings.where("tenantId").equals(tenantId).delete(),
          this.db.outbox.where("tenantId").equals(tenantId).delete(),
          this.db.syncMetadata.where("tenantId").equals(tenantId).delete()
        ]);
      }
    );
  }
}

// Global Singleton Repository
export const offlineRepository = new OfflineRepository();
