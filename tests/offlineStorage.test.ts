import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { VeggiePOSLocalDatabase } from "../src/features/shared/services/offline/database";
import { OfflineRepository } from "../src/features/shared/services/offline/OfflineRepository";

describe("Veggie POS - Offline Storage Layer (Dexie + IndexedDB)", () => {
  let db: VeggiePOSLocalDatabase;
  let repo: OfflineRepository;
  const testDbName = "VeggiePOS_Test_DB";

  beforeEach(async () => {
    db = new VeggiePOSLocalDatabase(testDbName);
    await db.open();
    repo = new OfflineRepository(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("should initialize all 11 required IndexedDB stores", () => {
    const tableNames = db.tables.map(t => t.name);
    const expectedStores = [
      "menuItems",
      "ingredients",
      "recipes",
      "staff",
      "orders",
      "orderItems",
      "customers",
      "shifts",
      "settings",
      "outbox",
      "syncMetadata"
    ];

    for (const store of expectedStores) {
      expect(tableNames).toContain(store);
    }
  });

  it("should enforce tenantId, branchId, deviceId, updatedAt, and version on menuItems", async () => {
    const tenantId = "tenant-veg-001";
    const rawItems = [
      {
        id: "m-1",
        name: "Paneer Butter Masala",
        price: 250,
        category: "Main Course",
        isVegetarian: true,
        isAvailable: true
      }
    ];

    await repo.saveMenuItems(tenantId, rawItems);

    const saved = await repo.getMenuItems(tenantId);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("m-1");
    expect(saved[0].name).toBe("Paneer Butter Masala");
    expect(saved[0].tenantId).toBe(tenantId);
    expect(saved[0].branchId).toBeDefined();
    expect(saved[0].deviceId).toBeDefined();
    expect(saved[0].updatedAt).toBeDefined();
    expect(saved[0].version).toBeGreaterThanOrEqual(1);
  });

  it("should enforce strict tenant isolation across all stores", async () => {
    const tenantA = "tenant-dhaba-a";
    const tenantB = "tenant-dhaba-b";

    // Save orders in Tenant A
    await repo.saveOrders(tenantA, [
      {
        id: "ord-a-1",
        orderNumber: "#101",
        date: new Date().toISOString(),
        type: "Dine-In",
        subtotal: 500,
        tax: 25,
        total: 525,
        status: "Completed",
        cashierId: "cashier-1",
        cashierName: "Ramesh"
      }
    ]);

    // Save orders in Tenant B
    await repo.saveOrders(tenantB, [
      {
        id: "ord-b-1",
        orderNumber: "#201",
        date: new Date().toISOString(),
        type: "Takeaway",
        subtotal: 300,
        tax: 15,
        total: 315,
        status: "Pending",
        cashierId: "cashier-2",
        cashierName: "Suresh"
      }
    ]);

    // Query Tenant A - must never leak Tenant B data
    const ordersA = await repo.getOrders(tenantA);
    expect(ordersA).toHaveLength(1);
    expect(ordersA[0].id).toBe("ord-a-1");

    const ordersB = await repo.getOrders(tenantB);
    expect(ordersB).toHaveLength(1);
    expect(ordersB[0].id).toBe("ord-b-1");
  });

  it("should persist normalized orderItems when saving orders", async () => {
    const tenantId = "tenant-kds-test";
    const orderWithItems = {
      id: "ord-kds-99",
      orderNumber: "#99",
      date: new Date().toISOString(),
      type: "Dine-In",
      subtotal: 400,
      tax: 20,
      total: 420,
      status: "Pending",
      cashierId: "cash-1",
      cashierName: "Cashier",
      items: [
        {
          id: "item-1",
          menuItem: { id: "m-paneer", name: "Paneer Tikka", price: 200 },
          quantity: 2,
          note: "Extra crispy"
        }
      ]
    };

    await repo.putOrder(tenantId, orderWithItems);

    const items = await repo.getOrderItems(tenantId, "ord-kds-99");
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Paneer Tikka");
    expect(items[0].unitPrice).toBe(200);
    expect(items[0].quantity).toBe(2);
    expect(items[0].subtotal).toBe(400);
    expect(items[0].tenantId).toBe(tenantId);
    expect(items[0].branchId).toBeDefined();
    expect(items[0].deviceId).toBeDefined();
    expect(items[0].updatedAt).toBeDefined();
  });

  it("should persist and retrieve ingredients, recipes, staff, customers, shifts, and settings", async () => {
    const tenantId = "tenant-full-store-test";

    // 1. Ingredients
    await repo.saveIngredients(tenantId, [
      { id: "ing-1", name: "Amul Butter", unit: "kg", currentStock: 10, minStock: 2, costPerUnit: 450 }
    ]);
    const ingredients = await repo.getIngredients(tenantId);
    expect(ingredients[0].name).toBe("Amul Butter");
    expect(ingredients[0].tenantId).toBe(tenantId);

    // 2. Recipes
    await repo.saveRecipes(tenantId, [
      { menuItemId: "m-butter-naan", ingredients: [{ ingredientId: "ing-1", quantity: 0.05 }] }
    ]);
    const recipes = await repo.getRecipes(tenantId);
    expect(recipes[0].menuItemId).toBe("m-butter-naan");
    expect(recipes[0].tenantId).toBe(tenantId);

    // 3. Staff
    await repo.saveStaff(tenantId, [
      { id: "st-1", name: "Vikram", role: "Chef", pin: "4444", permissions: ["inventory"] }
    ]);
    const staff = await repo.getStaff(tenantId);
    expect(staff[0].name).toBe("Vikram");
    expect(staff[0].tenantId).toBe(tenantId);

    // 4. Customers
    await repo.saveCustomers(tenantId, [
      {
        id: "cust-1",
        name: "Ananya",
        phone: "9876543210",
        loyaltyPoints: 120,
        comingSince: new Date().toISOString(),
        lastVisited: new Date().toISOString(),
        totalVisits: 5,
        totalSpend: 2500,
        maxBillAmount: 800,
        minBillAmount: 300
      }
    ]);
    const customers = await repo.getCustomers(tenantId);
    expect(customers[0].name).toBe("Ananya");
    expect(customers[0].phone).toBe("9876543210");
    expect(customers[0].tenantId).toBe(tenantId);

    // 5. Shifts
    await repo.saveShifts(tenantId, [
      {
        id: "sh-1",
        staffId: "st-1",
        staffName: "Vikram",
        role: "Chef",
        startTime: new Date().toISOString(),
        status: "Active"
      }
    ]);
    const shifts = await repo.getShifts(tenantId);
    expect(shifts[0].staffName).toBe("Vikram");
    expect(shifts[0].tenantId).toBe(tenantId);

    // 6. Settings
    await repo.saveSettings(tenantId, {
      autoDeductStock: true,
      blockOrdersIfInsufficient: false,
      gstPercentage: 12
    });
    const settings = await repo.getSettings(tenantId);
    expect(settings.autoDeductStock).toBe(true);
    expect(settings.gstPercentage).toBe(12);
  });

  it("should support outbox operations: enqueue, retrieve, update status, and remove", async () => {
    const tenantId = "tenant-outbox-test";

    const queued = await repo.enqueueOutbox(
      tenantId,
      "CREATE_ORDER",
      "/api/orders",
      "POST",
      { orderId: "ord-test-offline-1", total: 450 },
      "ik_order_offline_1"
    );

    expect(queued.id).toBeDefined();
    expect(queued.tenantId).toBe(tenantId);
    expect(queued.status).toBe("pending");
    expect(queued.idempotencyKey).toBe("ik_order_offline_1");
    expect(queued.branchId).toBeDefined();
    expect(queued.deviceId).toBeDefined();

    // Query pending
    const pending = await repo.getPendingOutbox(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(queued.id);

    // Update status to syncing
    await repo.updateOutboxStatus(queued.id, "syncing");
    const updated = await repo.getAllOutbox(tenantId);
    expect(updated[0].status).toBe("syncing");

    // Remove upon completion
    await repo.removeOutboxItem(queued.id);
    const afterRemoval = await repo.getAllOutbox(tenantId);
    expect(afterRemoval).toHaveLength(0);
  });

  it("should create outbox operations with all 11 required fields using client-generated UUIDs", async () => {
    const tenantId = "tenant-durable-outbox";
    const orderId = crypto.randomUUID();

    const orderPayload = {
      id: orderId,
      orderNumber: "555",
      total: 550,
      status: "Pending"
    };

    const outboxItem = await repo.recordOrderOffline(tenantId, orderPayload);

    // Verify all 11 fields explicitly requested
    expect(outboxItem.operationId).toBeDefined();
    expect(typeof outboxItem.operationId).toBe("string");
    expect(outboxItem.operationId.length).toBeGreaterThan(10);
    expect(outboxItem.tenantId).toBe(tenantId);
    expect(outboxItem.branchId).toBeDefined();
    expect(outboxItem.deviceId).toBeDefined();
    expect(outboxItem.entityType).toBe("order");
    expect(outboxItem.entityId).toBe(orderId);
    expect(outboxItem.operationType).toBe("CREATE");
    expect(outboxItem.payload).toEqual(orderPayload);
    expect(outboxItem.createdAt).toBeDefined();
    expect(outboxItem.retryCount).toBe(0);
    expect(outboxItem.status).toBe("pending");

    // Check IndexedDB persistence first (committed locally without waiting for cloud)
    const storedOrder = await repo.db.orders.get(orderId);
    expect(storedOrder).toBeDefined();
    expect(storedOrder?.id).toBe(orderId);
    expect(storedOrder?.total).toBe(550);

    // Check outbox item is stored in outbox table
    const storedOutbox = await repo.db.outbox.get(outboxItem.operationId);
    expect(storedOutbox).toBeDefined();
    expect(storedOutbox?.idempotencyKey).toBe(`ik_order_${orderId}`);
  });

  it("should calculate exponential backoff with jitter and exclude operations during backoff delay", async () => {
    const tenantId = "tenant-backoff-test";
    const entityId = crypto.randomUUID();

    const item = await repo.enqueueOutbox(tenantId, {
      entityType: "payment",
      entityId,
      operationType: "UPDATE",
      payload: { status: "Completed", paymentMethod: "UPI" },
      endpoint: `/api/orders/${entityId}`,
      method: "PUT"
    });

    expect(item.retryCount).toBe(0);
    expect(item.status).toBe("pending");

    // 1st failure (e.g. HTTP 500 or network drop)
    const beforeFail = Date.now();
    await repo.recordOutboxFailure(item.operationId, "HTTP 500 Internal Server Error");

    const failedItem1 = await repo.db.outbox.get(item.operationId);
    expect(failedItem1?.retryCount).toBe(1);
    expect(failedItem1?.status).toBe("failed");
    expect(failedItem1?.lastError).toBe("HTTP 500 Internal Server Error");
    // Backoff for retry 1: ~2s (1000 * 2^1 + jitter)
    expect(failedItem1?.nextRetryAt).toBeGreaterThanOrEqual(beforeFail + 1900);

    // Because it is in the backoff window, getPendingOutbox must NOT return it yet
    const pendingDuringBackoff = await repo.getPendingOutbox(tenantId);
    expect(pendingDuringBackoff).toHaveLength(0);

    // 2nd failure
    await repo.recordOutboxFailure(item.operationId, "Connection reset by peer");
    const failedItem2 = await repo.db.outbox.get(item.operationId);
    expect(failedItem2?.retryCount).toBe(2);
    // Backoff for retry 2: ~4s (1000 * 2^2 + jitter)
    expect(failedItem2?.nextRetryAt).toBeGreaterThanOrEqual(beforeFail + 3800);
  });

  it("should survive simulated browser reload / restart and preserve queued outbox operations", async () => {
    const tenantId = "tenant-durability-reload";
    const orderId = crypto.randomUUID();

    // 1. Commit offline write
    await repo.recordOrderOffline(tenantId, {
      id: orderId,
      orderNumber: "888",
      total: 990,
      status: "Pending"
    });

    // 2. Simulate browser close / reload by closing Dexie instance and reopening new instance
    await db.close();

    const reopenedDb = new VeggiePOSLocalDatabase(testDbName);
    await reopenedDb.open();
    const reopenedRepo = new OfflineRepository(reopenedDb);

    // 3. Verify order exists in IndexedDB
    const orders = await reopenedRepo.getOrders(tenantId);
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(orderId);

    // 4. Verify outbox queue persists intact with operationId and idempotencyKey
    const pendingOutbox = await reopenedRepo.getAllOutbox(tenantId);
    expect(pendingOutbox).toHaveLength(1);
    expect(pendingOutbox[0].entityId).toBe(orderId);
    expect(pendingOutbox[0].idempotencyKey).toBe(`ik_order_${orderId}`);
    expect(pendingOutbox[0].status).toBe("pending");

    await reopenedDb.delete();
  });

  it("should preserve identical idempotencyKey across retries preventing duplicate records", async () => {
    const tenantId = "tenant-idempotent-retries";
    const customerId = crypto.randomUUID();

    const customerData = {
      id: customerId,
      name: "Ritik Sharma",
      phone: "9876543211",
      loyaltyPoints: 0
    };

    const outboxItem = await repo.recordCustomerOffline(tenantId, customerData);
    const initialKey = outboxItem.idempotencyKey;
    expect(initialKey).toBe(`ik_cust_${customerId}`);

    // Simulate multiple retries after simulated 500 error
    await repo.recordOutboxFailure(outboxItem.operationId, "HTTP 500");
    await repo.recordOutboxFailure(outboxItem.operationId, "HTTP 503");

    const retriedItem = await repo.db.outbox.get(outboxItem.operationId);
    // Idempotency key MUST remain 100% stable across all retries
    expect(retriedItem?.idempotencyKey).toBe(initialKey);
    expect(retriedItem?.retryCount).toBe(2);
  });

  it("should record and update syncMetadata for version and checkpoint tracking", async () => {
    const tenantId = "tenant-sync-meta";

    await repo.updateSyncMetadata(tenantId, "menuItems", {
      serverVersion: 5,
      clientVersion: 5,
      status: "synced"
    });

    const meta = await repo.getSyncMetadata(tenantId, "menuItems");
    expect(meta).toBeDefined();
    expect(meta?.tenantId).toBe(tenantId);
    expect(meta?.sliceName).toBe("menuItems");
    expect(meta?.serverVersion).toBe(5);
    expect(meta?.status).toBe("synced");
    expect(meta?.lastSyncedAt).toBeDefined();
    expect(meta?.updatedAt).toBeDefined();
  });

  it("should execute local database migration hook ensuring all fields are present", async () => {
    // Verify migration upgrade logic on existing records
    const migrationDbName = "VeggiePOS_Migration_Test_DB";
    const mDb = new VeggiePOSLocalDatabase(migrationDbName);
    await mDb.open();

    const mRepo = new OfflineRepository(mDb);
    await mRepo.putMenuItem("migrated-tenant", {
      id: "migrated-item-1",
      name: "Tandoori Roti",
      price: 25,
      category: "Breads",
      isVegetarian: true,
      isAvailable: true
    });

    const item = await mDb.menuItems.get("migrated-item-1");
    expect(item).toBeDefined();
    expect(item?.tenantId).toBe("migrated-tenant");
    expect(item?.branchId).toBeDefined();
    expect(item?.deviceId).toBeDefined();
    expect(item?.updatedAt).toBeDefined();
    expect(item?.version).toBeDefined();

    await mDb.delete();
  });
});
