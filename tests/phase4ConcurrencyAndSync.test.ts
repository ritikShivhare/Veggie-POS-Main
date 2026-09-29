import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { app } from "../server";
import { Database } from "../server/features/shared/database";
import { IdempotencyService, computeRequestHash } from "../server/features/shared/IdempotencyService";
import { SyncService } from "../server/features/shared/SyncService";
import { OrderRepository } from "../server/features/pos/OrderRepository";
import { MenuRepository } from "../server/features/pos/MenuRepository";
import { StaffRepository } from "../server/features/staff/StaffRepository";
import { IngredientRepository } from "../server/features/inventory/IngredientRepository";
import { RecipeRepository } from "../server/features/inventory/RecipeRepository";
import { CustomerRepository } from "../server/features/crm/CustomerRepository";
import { PurchaseRepository } from "../server/features/inventory/PurchaseRepository";
import { ShiftRepository } from "../server/features/staff/ShiftRepository";
import { SettingsRepository } from "../server/features/shared/SettingsRepository";
import { hashPin } from "../server/features/auth/PinSecurityService";
import {
  staffRepo,
  orderRepo,
  ingredientRepo,
  recipeRepo,
  customerRepo,
  purchaseRepo,
  shiftRepo,
  settingsRepo,
  getGlobalTenantsList,
  saveGlobalTenantsList,
  realtimeService,
  sessionService
} from "../server/context";
import { MenuItem, Ingredient, Recipe, Customer } from "../src/features/shared/types";

describe("Phase 4: Idempotency, Optimistic Concurrency & Data-Loss Protection", () => {
  const TENANT_A = "phase4-tenant-alpha";
  const TENANT_B = "phase4-tenant-beta";
  const OWNER_PIN = "1234";

  let server: http.Server;
  let serverUrl: string = "";
  let ownerTokenA: string = "";
  let ownerTokenB: string = "";

  let db: Database;
  let menuRepo: MenuRepository;
  let syncService: SyncService;
  let idempotencyService: IdempotencyService;

  beforeAll(async () => {
    server = http.createServer(app);
    realtimeService.attach(server);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as any;
        serverUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const globalTenants = await getGlobalTenantsList();
    const existingIds = new Set(globalTenants.map((t) => t.tenantId));
    if (!existingIds.has(TENANT_A)) {
      globalTenants.push({
        id: `t-${TENANT_A}`,
        name: "Phase 4 Alpha Bistro",
        tenantId: TENANT_A,
        status: "active",
        created: "2026-09-28",
        region: "North India",
        ownerName: "Owner Alpha",
        email: "owner@alpha.com"
      });
    }
    if (!existingIds.has(TENANT_B)) {
      globalTenants.push({
        id: `t-${TENANT_B}`,
        name: "Phase 4 Beta Bistro",
        tenantId: TENANT_B,
        status: "active",
        created: "2026-09-28",
        region: "South India",
        ownerName: "Owner Beta",
        email: "owner@beta.com"
      });
    }
    await saveGlobalTenantsList(globalTenants);

    const sessionA = await sessionService.createSession(
      TENANT_A,
      "usr-owner-p4-a",
      "Vikram Owner",
      "Owner",
      "127.0.0.1",
      "vitest-agent",
      ["billing", "inventory", "reports", "settings", "staff", "orders"]
    );
    ownerTokenA = sessionA.sessionId;

    const sessionB = await sessionService.createSession(
      TENANT_B,
      "usr-owner-p4-b",
      "Suresh Owner",
      "Owner",
      "127.0.0.1",
      "vitest-agent",
      ["billing", "inventory", "reports", "settings", "staff", "orders"]
    );
    ownerTokenB = sessionB.sessionId;
  });

  afterAll(async () => {
    realtimeService.close();
    await new Promise<void>((resolve) => {
      if ((server as any).closeAllConnections) {
        (server as any).closeAllConnections();
      }
      server.close(() => resolve());
    });
  });

  beforeEach(async () => {
    db = Database.getInstance();
    (db as any).tablesByTenant[TENANT_A] = {};
    (db as any).tablesByTenant[TENANT_B] = {};

    menuRepo = new MenuRepository();
    idempotencyService = IdempotencyService.getInstance();
    idempotencyService.clearMemory();

    syncService = new SyncService(
      menuRepo,
      ingredientRepo,
      recipeRepo,
      staffRepo,
      orderRepo,
      customerRepo,
      purchaseRepo,
      shiftRepo,
      settingsRepo
    );

    // Seed Settings for Tenant A
    await settingsRepo.save(TENANT_A, {
      autoDeductStock: true,
      blockOrdersIfInsufficient: false,
      lowStockThreshold: 5,
      taxRate: 5,
      cgstRate: 2.5,
      sgstRate: 2.5,
      discountRules: []
    } as any);

    // Seed Staff for Tenant A and B so authMiddleware finds them
    await staffRepo.saveAll(TENANT_A, [
      {
        id: "usr-owner-p4-a",
        name: "Vikram Owner",
        role: "Owner" as any,
        pin: "dummy",
        permissions: ["billing", "inventory", "reports", "settings", "staff", "orders"]
      }
    ]);
    await staffRepo.saveAll(TENANT_B, [
      {
        id: "usr-owner-p4-b",
        name: "Suresh Owner",
        role: "Owner" as any,
        pin: "dummy",
        permissions: ["billing", "inventory", "reports", "settings", "staff", "orders"]
      }
    ]);

    // Seed Menu item for Tenant A
    await menuRepo.saveAll(TENANT_A, [
      {
        id: "menu-thali",
        tenantId: TENANT_A,
        name: "Special Veg Thali",
        price: 250,
        category: "Mains",
        isVegetarian: true,
        isAvailable: true,
        version: 1
      } as any
    ]);
  });

  // ============================================================================
  // 1. DATABASE-AUTHORITATIVE IDEMPOTENCY & PAYLOAD FINGERPRINTING
  // ============================================================================
  describe("Step 1 & 2: Database-Authoritative Idempotency & Semantics", () => {
    it("should replay previous response when same key and same payload are sent", async () => {
      const key = "ik-phase4-exact-twin";
      const payload = {
        id: "ord-p4-1",
        customerName: "Rohan",
        items: [{ menuItemId: "menu-thali", quantity: 2 }]
      };

      // Request 1
      const res1 = await fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`,
          "Idempotency-Key": key
        },
        body: JSON.stringify(payload)
      });

      expect(res1.status).toBe(200);
      expect(res1.headers.get("idempotency-key")).toBe(key);
      expect(res1.headers.get("idempotent-replayed")).toBeNull();
      const data1 = await res1.json();

      // Request 2 (identical payload)
      const res2 = await fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`,
          "Idempotency-Key": key
        },
        body: JSON.stringify(payload)
      });

      expect(res2.status).toBe(200);
      expect(res2.headers.get("idempotent-replayed")).toBe("true");
      expect(res2.headers.get("idempotency-key")).toBe(key);
      const data2 = await res2.json();
      expect(data2.order.id).toBe(data1.order.id);
      expect(data2.order.total).toBe(data1.order.total);

      // Verify only 1 order exists in database
      const allOrders = await orderRepo.getAll(TENANT_A);
      expect(allOrders).toHaveLength(1);
    });

    it("should deterministically REJECT with 422 when same key is sent with DIFFERENT payload", async () => {
      const key = "ik-phase4-payload-mismatch";
      const payload1 = {
        id: "ord-mismatch-1",
        customerName: "Original Client",
        items: [{ menuItemId: "menu-thali", quantity: 1 }]
      };
      const payload2 = {
        id: "ord-mismatch-2",
        customerName: "Divergent Fraudulent Payload",
        items: [{ menuItemId: "menu-thali", quantity: 5 }]
      };

      // Request 1: succeeds
      const res1 = await fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`,
          "Idempotency-Key": key
        },
        body: JSON.stringify(payload1)
      });
      expect(res1.status).toBe(200);

      // Request 2: same key, different payload -> MUST be rejected!
      const res2 = await fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`,
          "Idempotency-Key": key
        },
        body: JSON.stringify(payload2)
      });

      expect(res2.status).toBe(422);
      const data2 = await res2.json();
      expect(data2.success).toBe(false);
      expect(data2.error).toBe("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");

      // Verify second order was NEVER written to database
      const ghost = await orderRepo.getById(TENANT_A, "ord-mismatch-2");
      expect(ghost).toBeNull();
    });

    it("should maintain strict tenant isolation: Tenant A's idempotency key never blocks Tenant B", async () => {
      const sharedKey = "ik-cross-tenant-shared-001";
      const payloadA = {
        id: "ord-tenant-a-1",
        customerName: "Customer Alpha",
        items: [{ menuItemId: "menu-thali", quantity: 1 }]
      };

      // Seed menu item for Tenant B
      await menuRepo.saveAll(TENANT_B, [
        {
          id: "menu-thali-b",
          tenantId: TENANT_B,
          name: "Tenant B Thali",
          price: 300,
          category: "Mains",
          isVegetarian: true,
          isAvailable: true,
          version: 1
        } as any
      ]);

      const payloadB = {
        id: "ord-tenant-b-1",
        customerName: "Customer Beta",
        items: [{ menuItemId: "menu-thali-b", quantity: 1 }]
      };

      // Tenant A uses key
      const resA = await fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`,
          "Idempotency-Key": sharedKey
        },
        body: JSON.stringify(payloadA)
      });
      expect(resA.status).toBe(200);

      // Tenant B uses SAME key -> MUST succeed independently and not collide with Tenant A
      const resB = await fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenB}`,
          "Idempotency-Key": sharedKey
        },
        body: JSON.stringify(payloadB)
      });
      expect(resB.status).toBe(200);
      expect(resB.headers.get("idempotent-replayed")).toBeNull();
      const dataB = await resB.json();
      expect(dataB.order.id).toBe("ord-tenant-b-1");

      // Verify records are isolated
      const orderA = await orderRepo.getById(TENANT_A, "ord-tenant-a-1");
      const orderB = await orderRepo.getById(TENANT_B, "ord-tenant-b-1");
      expect(orderA).not.toBeNull();
      expect(orderB).not.toBeNull();
    });

    it("should recover and reclaim an idempotency key if a previous worker crashed leaving it in PROCESSING status", async () => {
      const crashKey = "ik-crashed-worker-lease";
      const expiredTimestamp = new Date(Date.now() - 70000).toISOString(); // 70 seconds ago (> 60s lease)

      // Simulate a crashed server that reserved the key but crashed before res.json
      await idempotencyService.saveRecord({
        tenant_id: TENANT_A,
        idempotency_key: crashKey,
        status_code: 0,
        response_body: null,
        status: "PROCESSING",
        expires_at: expiredTimestamp,
        request_hash: computeRequestHash({ id: "ord-recovered", customerName: "Crash Recovery", items: [{ menuItemId: "menu-thali", quantity: 1 }] })
      });

      // New request arrives for the same key
      const res = await fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`,
          "Idempotency-Key": crashKey
        },
        body: JSON.stringify({
          id: "ord-recovered",
          customerName: "Crash Recovery",
          items: [{ menuItemId: "menu-thali", quantity: 1 }]
        })
      });

      // Must succeed and reclaim the expired lease instead of blocking permanently!
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.order.id).toBe("ord-recovered");
    });
  });

  // ============================================================================
  // 2. OPTIMISTIC CONCURRENCY & STALE UPDATE PROTECTION
  // ============================================================================
  describe("Step 3: Optimistic Concurrency & Stale Update Protection", () => {
    it("should reject stale update with HTTP 409 CONFLICT when version is outdated (version 6 -> 7 scenario)", async () => {
      // Setup order at version 6
      const orderId = "ord-opt-version-6";
      await orderRepo.add(TENANT_A, {
        id: orderId,
        orderNumber: "#2006",
        total: 500,
        status: "Pending",
        version: 6
      } as any);

      // Verify current version is 6
      const initial = await orderRepo.getById(TENANT_A, orderId);
      expect((initial as any).version).toBe(6);

      // Device A updates order using version 6 -> server accepts and increments to 7
      const resA = await fetch(`${serverUrl}/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({
          status: "Preparing",
          version: 6
        })
      });

      expect(resA.status).toBe(200);
      const afterA = await orderRepo.getById(TENANT_A, orderId);
      expect((afterA as any).version).toBe(7);
      expect((afterA as any).status).toBe("Preparing");

      // Device B attempts update using STALE version 6
      const resB = await fetch(`${serverUrl}/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({
          status: "Ready",
          version: 6 // STALE! Current server version is 7
        })
      });

      // MUST be rejected with HTTP 409 CONFLICT
      expect(resB.status).toBe(409);
      const bodyB = await resB.json();
      expect(bodyB.success).toBe(false);
      expect(bodyB.error).toBe("OPTIMISTIC_LOCK_CONFLICT");
      expect(bodyB.expectedVersion).toBe(6);
      expect(bodyB.currentVersion).toBe(7);

      // Verify server order version 7 was NOT overwritten
      const finalOrder = await orderRepo.getById(TENANT_A, orderId);
      expect((finalOrder as any).version).toBe(7);
      expect((finalOrder as any).status).toBe("Preparing"); // Not "Ready"
    });

    it("should handle concurrent conflicting updates where only the first succeeds and second gets 409", async () => {
      const orderId = "ord-concurrent-race";
      await orderRepo.add(TENANT_A, {
        id: orderId,
        orderNumber: "#3001",
        total: 500,
        status: "Pending",
        version: 1
      } as any);

      // Launch 2 simultaneous updates both targeting version 1
      const [res1, res2] = await Promise.all([
        fetch(`${serverUrl}/api/orders/${orderId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ownerTokenA}`
          },
          body: JSON.stringify({ status: "Preparing", notes: "From Device 1", version: 1 })
        }),
        fetch(`${serverUrl}/api/orders/${orderId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ownerTokenA}`
          },
          body: JSON.stringify({ status: "Cancelled", notes: "From Device 2", version: 1 })
        })
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must be 200, and one must be 409
      expect(statuses).toEqual([200, 409]);

      // Server state is guaranteed consistent at version 2
      const finalOrder = await orderRepo.getById(TENANT_A, orderId);
      expect((finalOrder as any).version).toBe(2);
    });

    it("should enforce optimistic locking on customer profiles (PUT /customers/:id)", async () => {
      const customerId = "cust-opt-1";
      await customerRepo.add(TENANT_A, {
        id: customerId,
        name: "Pooja Sharma",
        phone: "9876543210",
        loyaltyPoints: 100,
        version: 1
      } as any);

      // Client A updates customer (version 1 -> 2)
      const res1 = await fetch(`${serverUrl}/api/customers/${customerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({ loyaltyPoints: 150, version: 1 })
      });
      expect(res1.status).toBe(200);

      // Client B tries to update using stale version 1
      const res2 = await fetch(`${serverUrl}/api/customers/${customerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({ loyaltyPoints: 200, version: 1 })
      });

      expect(res2.status).toBe(409);
      const data2 = await res2.json();
      expect(data2.error).toBe("OPTIMISTIC_LOCK_CONFLICT");
    });
  });

  // ============================================================================
  // 3. CRITICAL DATA-LOSS AUDIT & STALE SNAPSHOT PROTECTION
  // ============================================================================
  describe("Step 4 & 5: Critical Data-Loss Audit & Safe Reconciliation", () => {
    it("MANDATORY TEST: should PRESERVE Order C when Device 1 submits an old snapshot containing only A + B", async () => {
      // Step 1: Initial server has Order A and Order B
      await orderRepo.saveAll(TENANT_A, [
        { id: "ord-A", orderNumber: "#A", total: 100, status: "Completed", version: 1 },
        { id: "ord-B", orderNumber: "#B", total: 200, status: "Completed", version: 1 }
      ] as any);

      // Step 2: Device 1 downloads snapshot containing A + B
      const device1Snapshot = await syncService.getFullState(TENANT_A);
      expect(device1Snapshot.orders).toHaveLength(2);

      // Step 3: Device 2 creates Order C on the server
      await orderRepo.add(TENANT_A, {
        id: "ord-C",
        orderNumber: "#C",
        total: 300,
        status: "Pending",
        version: 1
      } as any);

      // Verify server now has A + B + C
      const serverBefore = await orderRepo.getAll(TENANT_A);
      expect(serverBefore).toHaveLength(3);
      expect(serverBefore?.map((o) => o.id).sort()).toEqual(["ord-A", "ord-B", "ord-C"]);

      // Step 4: Device 1 (which only has A + B) submits its old full snapshot via POST /sync
      const syncRes = await fetch(`${serverUrl}/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({
          orders: [
            { id: "ord-A", orderNumber: "#A", total: 100, status: "Completed", version: 1 },
            { id: "ord-B", orderNumber: "#B", total: 200, status: "Completed", version: 1 }
          ]
        })
      });

      expect(syncRes.status).toBe(200);

      // Step 5: VERIFY ORDER C MUST REMAIN IN THE DATABASE!
      const serverAfter = await orderRepo.getAll(TENANT_A);
      const ids = serverAfter?.map((o) => o.id).sort();
      expect(ids).toContain("ord-C");
      expect(ids).toEqual(["ord-A", "ord-B", "ord-C"]);

      const orderC = await orderRepo.getById(TENANT_A, "ord-C");
      expect(orderC).not.toBeNull();
      expect((orderC as any).status).toBe("Pending");
    });

    it("should PRESERVE existing ingredients and customers when a partial snapshot is synced", async () => {
      // Seed server with 2 ingredients
      await ingredientRepo.saveAll(TENANT_A, [
        { id: "ing-tomato", name: "Tomato", currentStock: 10, unit: "kg", costPerUnit: 20, minStockAlert: 2, version: 1 },
        { id: "ing-onion", name: "Onion", currentStock: 25, unit: "kg", costPerUnit: 15, minStockAlert: 5, version: 1 }
      ] as any);

      // Device sends snapshot with ONLY Tomato updated
      await syncService.saveFullState(TENANT_A, {
        ingredients: [
          { id: "ing-tomato", name: "Tomato", currentStock: 8, unit: "kg", costPerUnit: 20, minStockAlert: 2, version: 1 }
        ]
      });

      // Onion MUST remain intact!
      const allIngredients = await ingredientRepo.getAll(TENANT_A);
      expect(allIngredients?.map((i) => i.id).sort()).toEqual(["ing-onion", "ing-tomato"]);
      const onion = await ingredientRepo.getById(TENANT_A, "ing-onion");
      expect(onion?.currentStock).toBe(25);
    });

    it("should reject full state sync with 409 if any incoming entity has a stale version", async () => {
      // Seed order at version 2
      await orderRepo.saveAll(TENANT_A, [
        { id: "ord-ver-check", orderNumber: "#99", total: 200, status: "Preparing", version: 2 }
      ] as any);

      // Client submits snapshot with stale version 1
      const res = await fetch(`${serverUrl}/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({
          orders: [
            { id: "ord-ver-check", orderNumber: "#99", total: 200, status: "Ready", version: 1 }
          ]
        })
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe("OPTIMISTIC_LOCK_CONFLICT");
    });
  });

  // ============================================================================
  // 4. SYNC OUTBOX VALIDATION & SECURITY
  // ============================================================================
  describe("Step 6: Sync Outbox Integrity & Security", () => {
    it("should reject forged outbox command with mismatched tenantId (403 CROSS_TENANT_VIOLATION)", async () => {
      const res = await fetch(`${serverUrl}/api/sync/outbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({
          operationId: "op-forged-tenant",
          tenantId: "tenant-victim-corp", // Forged! Does not match session
          entityType: "order",
          entityId: "ord-forged-1",
          operationType: "CREATE",
          payload: {
            id: "ord-forged-1",
            total: 250,
            items: [{ menuItemId: "menu-thali", quantity: 1 }]
          }
        })
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("CROSS_TENANT_VIOLATION");
    });

    it("should reject outbox command when payload contains mismatched tenantId", async () => {
      const res = await fetch(`${serverUrl}/api/sync/outbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({
          operationId: "op-forged-payload-tenant",
          entityType: "order",
          entityId: "ord-forged-2",
          operationType: "CREATE",
          payload: {
            id: "ord-forged-2",
            tenantId: "tenant-victim-corp", // Forged inside payload!
            total: 250,
            items: [{ menuItemId: "menu-thali", quantity: 1 }]
          }
        })
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("CROSS_TENANT_VIOLATION");
    });

    it("should reject outbox command missing required fields with 422 VALIDATION_ERROR", async () => {
      const res = await fetch(`${serverUrl}/api/sync/outbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({
          operationId: "op-missing-type"
          // Missing entityType, entityId, operationType, payload
        })
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe("VALIDATION_ERROR");
    });

    it("should enforce optimistic locking on outbox UPDATE operations", async () => {
      // Seed customer at version 2
      await customerRepo.add(TENANT_A, {
        id: "cust-outbox-1",
        name: "Aman Verma",
        phone: "9123456780",
        loyaltyPoints: 50,
        version: 2
      } as any);

      // Outbox UPDATE command with stale version 1
      const res = await fetch(`${serverUrl}/api/sync/outbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`
        },
        body: JSON.stringify({
          operationId: "op-stale-outbox-update",
          entityType: "customer",
          entityId: "cust-outbox-1",
          operationType: "UPDATE",
          payload: {
            id: "cust-outbox-1",
            name: "Aman Verma Updated",
            version: 1 // STALE! Server is version 2
          }
        })
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe("OPTIMISTIC_LOCK_CONFLICT");
    });

    it("should successfully execute outbox command and return full canonical outbox structure", async () => {
      const res = await fetch(`${serverUrl}/api/sync/outbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerTokenA}`,
          "x-branch-id": "branch-south",
          "x-device-id": "pos-terminal-04"
        },
        body: JSON.stringify({
          operationId: "op-valid-101",
          idempotencyKey: "ik-outbox-101",
          entityType: "order",
          entityId: "ord-outbox-101",
          operationType: "CREATE",
          payload: {
            id: "ord-outbox-101",
            customerName: "Dine In Guest",
            items: [{ menuItemId: "menu-thali", quantity: 2 }]
          },
          createdAt: new Date().toISOString(),
          retryCount: 0
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe("SYNCED");
      expect(data.operationId).toBe("op-valid-101");
      expect(data.idempotencyKey).toBe("ik-outbox-101");
      expect(data.tenantId).toBe(TENANT_A);
      expect(data.branchId).toBe("branch-south");
      expect(data.deviceId).toBe("pos-terminal-04");
      expect(data.canonicalData).toBeDefined();
      expect(data.canonicalData.total).toBe(500); // 2 * 250 authoritative menu price
    });
  });
});
