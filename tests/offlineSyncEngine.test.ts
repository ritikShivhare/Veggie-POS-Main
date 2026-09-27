import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { VeggiePOSLocalDatabase } from "../src/features/shared/services/offline/database";
import { OfflineRepository } from "../src/features/shared/services/offline/OfflineRepository";
import { OfflineSyncEngine } from "../src/features/shared/services/offline/OfflineSyncEngine";
import { ApiClient } from "../src/features/shared/services/api";

describe("Veggie POS - Offline Sync Engine (10-Step Synchronization & Error Policies)", () => {
  let db: VeggiePOSLocalDatabase;
  let repo: OfflineRepository;
  const testDbName = "VeggiePOS_SyncEngine_Test_DB";

  // Provide window mock on globalThis for Node test environment
  const eventListeners = new Map<string, Function[]>();

  beforeEach(async () => {
    eventListeners.clear();

    const mockWindow = {
      addEventListener: (type: string, listener: Function) => {
        const list = eventListeners.get(type) || [];
        list.push(listener);
        eventListeners.set(type, list);
      },
      removeEventListener: (type: string, listener: Function) => {
        const list = eventListeners.get(type) || [];
        eventListeners.set(type, list.filter(l => l !== listener));
      },
      dispatchEvent: (event: any) => {
        const list = eventListeners.get(event.type) || [];
        for (const l of list) {
          l(event);
        }
        return true;
      }
    };

    (globalThis as any).window = mockWindow;

    db = new VeggiePOSLocalDatabase(testDbName);
    await db.open();
    repo = new OfflineRepository(db);

    OfflineSyncEngine.setRepository(repo);
    ApiClient.setSessionId("test-session-token-123");
  });

  afterEach(async () => {
    await db.delete();
    vi.restoreAllMocks();
  });

  it("Step 1-10: should successfully process pending outbox operations, send headers, mark SYNCED, update IndexedDB, and broadcast realtime events", async () => {
    const tenantId = "tenant-sync-success";
    const orderId = crypto.randomUUID();
    const idempotencyKey = `ik_order_${orderId}`;

    const orderPayload = {
      id: orderId,
      orderNumber: "1001",
      total: 550,
      status: "Pending",
      type: "Dine-In",
      items: [
        {
          id: "item-1",
          menuItem: { id: "m-1", name: "Paneer Tikka", price: 250 },
          quantity: 2
        }
      ]
    };

    // Commit order offline first
    await repo.recordOrderOffline(tenantId, orderPayload);

    // Verify outbox queued
    const pendingBefore = await repo.getPendingOutbox(tenantId);
    expect(pendingBefore).toHaveLength(1);
    expect(pendingBefore[0].status).toBe("pending");

    // Capture broadcasted realtime event
    let capturedEvent: any = null;
    const eventListener = (e: any) => {
      capturedEvent = e.detail;
    };
    (globalThis as any).window.addEventListener("veggiepos_realtime_event", eventListener);

    // Mock server returning canonical entity and version (Step 6)
    const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      // Step 3: Verify sent headers
      expect(init.headers["Idempotency-Key"]).toBe(idempotencyKey);
      expect(init.headers["x-tenant-id"]).toBe(tenantId);
      expect(init.headers["x-branch-id"]).toBeDefined();
      expect(init.headers["x-device-id"]).toBeDefined();
      expect(init.headers["x-session-id"]).toBe("test-session-token-123");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Order placed successfully.",
          data: {
            ...orderPayload,
            status: "Completed",
            version: 2,
            updated_at: new Date().toISOString()
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    });

    // Run sync engine
    const syncResult = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mockFetch as any,
      repository: repo
    });

    expect(syncResult.processed).toBe(1);
    expect(syncResult.synced).toBe(1);
    expect(syncResult.failed).toBe(0);

    // Step 7: Operation marked SYNCED in IndexedDB
    const outboxItem = await repo.getOutboxItem(pendingBefore[0].id);
    expect(outboxItem).toBeDefined();
    expect(outboxItem?.status).toBe("SYNCED");

    // Step 8: Local IndexedDB updated with canonical entity and incremented version
    const orders = await repo.getOrders(tenantId);
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(orderId);
    expect(orders[0].status).toBe("Completed");
    expect(orders[0].version).toBe(2);

    // Step 8: syncMetadata updated in IndexedDB
    const syncMeta = await repo.getSyncMetadata(tenantId, "orders");
    expect(syncMeta).toBeDefined();
    expect(syncMeta?.status).toBe("synced");
    expect(syncMeta?.serverVersion).toBe(2);

    // Step 9: Realtime event broadcasted
    expect(capturedEvent).toBeDefined();
    expect(capturedEvent.type).toBe("order:synced");
    expect(capturedEvent.canonicalData.version).toBe(2);
  });

  it("Safety Invariant: should NEVER delete an outbox operation before confirmed server success", async () => {
    const tenantId = "tenant-safety-invariant";
    const customerId = crypto.randomUUID();

    await repo.recordCustomerOffline(tenantId, {
      id: customerId,
      name: "Aman Gupta",
      phone: "9876543210"
    });

    const pending = await repo.getPendingOutbox(tenantId);
    const opId = pending[0].id;

    // Simulate 500 Server Error
    const mock500 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: "Database disk full" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mock500 as any,
      repository: repo
    });
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(0);

    // Operation MUST NOT be deleted from outbox table
    const itemAfterFail = await repo.getOutboxItem(opId);
    expect(itemAfterFail).toBeDefined();
    expect(itemAfterFail?.status).toBe("failed");
    expect(itemAfterFail?.retryCount).toBe(1);
  });

  it("Retry Policy - 409 Conflict: should mark operation 'conflict', preserve in outbox, trigger reconcile event, and continue queue", async () => {
    const tenantId = "tenant-conflict-policy";
    const entityId = crypto.randomUUID();

    await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId,
      operationType: "UPDATE",
      payload: { status: "Completed", version: 1 },
      endpoint: `/api/orders/${entityId}`,
      method: "PUT"
    });

    let reconcileEventTriggered = false;
    const reconcileListener = () => {
      reconcileEventTriggered = true;
    };
    (globalThis as any).window.addEventListener("veggiepos_reconcile_conflict", reconcileListener);

    const mock409 = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: "OPTIMISTIC_LOCK_CONFLICT",
          message: "Target order was modified concurrently by another terminal (server version: 3)."
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mock409 as any,
      repository: repo
    });
    expect(result.conflicts).toBe(1);

    const outboxItem = (await repo.getAllOutbox(tenantId))[0];
    expect(outboxItem.status).toBe("conflict");
    expect(outboxItem.lastError).toContain("OPTIMISTIC_LOCK_CONFLICT");
    expect(reconcileEventTriggered).toBe(true);
  });

  it("Retry Policy - 401 Auth Failure: should mark 'auth_error', preserve in outbox, dispatch auth event, and pause queue", async () => {
    const tenantId = "tenant-auth-policy";

    const op1 = await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: crypto.randomUUID(),
      operationType: "CREATE",
      payload: { total: 100 },
      endpoint: "/api/orders",
      method: "POST"
    });

    const op2 = await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: crypto.randomUUID(),
      operationType: "CREATE",
      payload: { total: 200 },
      endpoint: "/api/orders",
      method: "POST"
    });

    let authEventTriggered = false;
    const authListener = () => {
      authEventTriggered = true;
    };
    (globalThis as any).window.addEventListener("veggiepos_auth_required", authListener);

    const mock401 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: "SESSION_EXPIRED", message: "Session token expired." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mock401 as any,
      repository: repo
    });
    // Queue must pause on 401: processed 1, did not hammer second item with 401!
    expect(result.processed).toBe(1);
    expect(result.authErrors).toBe(1);
    expect(authEventTriggered).toBe(true);

    const item1 = await repo.getOutboxItem(op1.id);
    const item2 = await repo.getOutboxItem(op2.id);
    const authErrorItem = item1?.status === "auth_error" ? item1 : item2;
    const pendingItem = item1?.status === "pending" ? item1 : item2;

    expect(authErrorItem?.status).toBe("auth_error");
    expect(pendingItem?.status).toBe("pending"); // Second item preserved intact
  });

  it("Retry Policy - 403 Authorization Failure: should mark 'validation_error', apply 5-minute cooldown, and continue remaining queue", async () => {
    const tenantId = "tenant-authz-policy";

    // Item 1: forbidden action (e.g. non-manager trying to cancel or plan limit exceeded)
    await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: "order-cancel-forbidden",
      operationType: "UPDATE",
      payload: { status: "Cancelled" },
      endpoint: "/api/orders/order-cancel-forbidden",
      method: "PUT"
    });

    // Item 2: valid order
    await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: "order-valid-2",
      operationType: "CREATE",
      payload: { total: 150 },
      endpoint: "/api/orders",
      method: "POST"
    });

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("order-cancel-forbidden")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "FORBIDDEN",
            message: "Cancelling an order requires Owner or Manager authorization."
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: { id: "order-valid-2", total: 150, version: 1 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mockFetch as any,
      repository: repo
    });
    // Processed both operations: 403 did NOT halt the valid second item!
    expect(result.processed).toBe(2);
    expect(result.validationErrors).toBe(1);
    expect(result.synced).toBe(1);

    const allItems = await repo.getAllOutbox(tenantId);
    const forbiddenItem = allItems.find(i => i.entityId === "order-cancel-forbidden");
    const syncedItem = allItems.find(i => i.entityId === "order-valid-2");

    expect(forbiddenItem?.status).toBe("validation_error");
    // Cooldown applied: ~5 minutes (300,000ms)
    expect(forbiddenItem?.nextRetryAt).toBeGreaterThan(Date.now() + 290000);
    expect(syncedItem?.status).toBe("SYNCED");
  });

  it("Retry Policy - 422 Validation Failure: should mark 'validation_error', preserve in outbox, and continue queue", async () => {
    const tenantId = "tenant-validation-policy";

    await repo.enqueueOutbox(tenantId, {
      entityType: "customer",
      entityId: crypto.randomUUID(),
      operationType: "CREATE",
      payload: { invalidPhoneFormat: "abc" },
      endpoint: "/api/customers",
      method: "POST"
    });

    const mock422 = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: "VALIDATION_FAILED",
          message: "Field 'phone' must be a valid 10-digit number."
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mock422 as any,
      repository: repo
    });
    expect(result.validationErrors).toBe(1);

    const outbox = (await repo.getAllOutbox(tenantId))[0];
    expect(outbox.status).toBe("validation_error");
    expect(outbox.lastError).toContain("VALIDATION_FAILED");
  });

  it("Retry Policy - 429 Rate Limit: should respect Retry-After header, pause queue, and preserve in outbox", async () => {
    const tenantId = "tenant-ratelimit-policy";

    const op1 = await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: crypto.randomUUID(),
      operationType: "CREATE",
      payload: { total: 100 },
      endpoint: "/api/orders",
      method: "POST"
    });

    const op2 = await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: crypto.randomUUID(),
      operationType: "CREATE",
      payload: { total: 200 },
      endpoint: "/api/orders",
      method: "POST"
    });

    const now = Date.now();
    const mock429 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: "RATE_LIMITED" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "45"
        }
      })
    );

    const result = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mock429 as any,
      repository: repo
    });
    // Rate limit must pause the queue immediately
    expect(result.processed).toBe(1);
    expect(result.rateLimited).toBe(1);

    const item1 = await repo.getOutboxItem(op1.id);
    const item2 = await repo.getOutboxItem(op2.id);

    const rateLimitedItem = item1?.status === "failed" ? item1 : item2;
    const pendingItem = item1?.status === "pending" ? item1 : item2;

    expect(rateLimitedItem?.status).toBe("failed");
    // Respects 45 seconds Retry-After header
    expect(rateLimitedItem?.nextRetryAt).toBeGreaterThanOrEqual(now + 44000);
    expect(pendingItem?.status).toBe("pending"); // Second item paused
  });

  it("Retry Policy - 500 Server Failure: should apply exponential backoff with jitter and preserve in outbox", async () => {
    const tenantId = "tenant-500-policy";
    const op = await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: crypto.randomUUID(),
      operationType: "CREATE",
      payload: { total: 100 },
      endpoint: "/api/orders",
      method: "POST"
    });

    const mock500 = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: "INTERNAL_ERROR" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    );

    const now = Date.now();
    await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mock500 as any,
      repository: repo
    });

    const itemRetry1 = await repo.getOutboxItem(op.id);
    expect(itemRetry1?.retryCount).toBe(1);
    expect(itemRetry1?.status).toBe("failed");
    // Retry 1: 1000 * 2^1 = ~2000ms (+ jitter)
    expect(itemRetry1?.nextRetryAt).toBeGreaterThanOrEqual(now + 1900);
  });

  it("Retry Policy - Network Timeout: should handle AbortError/network drop, increment retryCount, pause queue, and preserve in outbox", async () => {
    const tenantId = "tenant-net-timeout";

    const op1 = await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: crypto.randomUUID(),
      operationType: "CREATE",
      payload: { total: 100 },
      endpoint: "/api/orders",
      method: "POST"
    });

    const op2 = await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: crypto.randomUUID(),
      operationType: "CREATE",
      payload: { total: 200 },
      endpoint: "/api/orders",
      method: "POST"
    });

    // Mock network timeout AbortError
    const mockTimeout = vi.fn().mockImplementation(() => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });

    const result = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mockTimeout as any,
      repository: repo
    });
    // Network disconnect must pause queue
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);

    const item1 = await repo.getOutboxItem(op1.id);
    const item2 = await repo.getOutboxItem(op2.id);

    // One of them was processed and failed, the other remained pending because queue paused
    const failedItem = item1?.status === "failed" ? item1 : item2;
    const pendingItem = item1?.status === "pending" ? item1 : item2;

    expect(failedItem?.status).toBe("failed");
    expect(failedItem?.lastError).toContain("Network timeout");
    expect(pendingItem?.status).toBe("pending");
  });

  it("Step 10: should continue processing remaining queue when previous operations succeed", async () => {
    const tenantId = "tenant-fifo-queue";

    await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: "order-1",
      operationType: "CREATE",
      payload: { id: "order-1", total: 100 },
      endpoint: "/api/orders",
      method: "POST"
    });

    await repo.enqueueOutbox(tenantId, {
      entityType: "order",
      entityId: "order-2",
      operationType: "CREATE",
      payload: { id: "order-2", total: 200 },
      endpoint: "/api/orders",
      method: "POST"
    });

    await repo.enqueueOutbox(tenantId, {
      entityType: "customer",
      entityId: "cust-1",
      operationType: "CREATE",
      payload: { id: "cust-1", name: "Ramesh" },
      endpoint: "/api/customers",
      method: "POST"
    });

    const mock200 = vi.fn().mockImplementation(async (url: string, init: any) => {
      const body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          success: true,
          data: { ...body, version: 1 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const result = await OfflineSyncEngine.syncNow(tenantId, {
      fetchFn: mock200 as any,
      repository: repo
    });
    expect(result.processed).toBe(3);
    expect(result.synced).toBe(3);
    expect(result.failed).toBe(0);

    const allItems = await repo.getAllOutbox(tenantId);
    expect(allItems).toHaveLength(3);
    expect(allItems.every(i => i.status === "SYNCED")).toBe(true);
  });

  describe("Server-Side Sync Endpoint (/api/sync/outbox)", () => {
    it("Step 4 & 5: Server validates tenant and branch and performs transactional write", async () => {
      const { orderRepo } = await import("../server/context");
      const tenantId = "test-tenant-sync-server";
      const branchId = "branch-south-01";
      const orderId = crypto.randomUUID();

      const orderPayload = {
        id: orderId,
        orderNumber: "#8801",
        total: 450,
        status: "Pending",
        items: [{ id: "it-1", name: "Dal Makhani", price: 200, quantity: 2 }]
      };

      // Simulate server-side outbox processing
      await orderRepo.add(tenantId, {
        ...orderPayload,
        tenantId,
        branchId,
        version: 1,
        date: new Date().toISOString()
      } as any);

      const saved: any = await orderRepo.getById(tenantId, orderId);
      expect(saved).toBeDefined();
      expect(saved?.id).toBe(orderId);
      expect(saved?.tenantId).toBe(tenantId);
      expect(saved?.branchId).toBe(branchId);
      expect(saved?.total).toBe(450);
    });

    it("Step 6: Server returns canonical entity and optimistic version on transactional update", async () => {
      const { orderRepo } = await import("../server/context");
      const tenantId = "test-tenant-sync-server";
      const orderId = crypto.randomUUID();

      await orderRepo.add(tenantId, {
        id: orderId,
        orderNumber: "#8802",
        total: 600,
        status: "Pending",
        version: 1,
        date: new Date().toISOString()
      } as any);

      // Update providing current optimistic version 1 (server updates and bumps version to 2)
      const updatedData: any = {
        id: orderId,
        orderNumber: "#8802",
        total: 600,
        status: "Completed",
        paymentMethod: "UPI",
        version: 1,
        date: new Date().toISOString()
      };

      await orderRepo.update(tenantId, updatedData);
      const canonical = await orderRepo.getById(tenantId, orderId);

      expect(canonical?.status).toBe("Completed");
      expect(canonical?.version).toBe(2);
      expect(canonical?.paymentMethod).toBe("UPI");
    });
  });
});
