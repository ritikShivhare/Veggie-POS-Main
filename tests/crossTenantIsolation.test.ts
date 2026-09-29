import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { app } from "../server";
import {
  staffRepo,
  orderRepo,
  customerRepo,
  ingredientRepo,
  settingsRepo,
  getGlobalTenantsList,
  saveGlobalTenantsList,
  eventBus,
  realtimeService
} from "../server/context";
import { hashPin } from "../server/features/auth/PinSecurityService";
import { SESSION_COOKIE_NAME } from "../server/features/auth/SessionService";

describe("Cross-Tenant Isolation and Server-Side RBAC Hardening Suite", () => {
  let server: http.Server;
  let serverUrl: string;

  const TENANT_A = "tenant-restaurant-alpha";
  const TENANT_B = "tenant-restaurant-beta";

  const OWNER_A_PIN = "1111";
  const CASHIER_A_PIN = "2222";
  const OWNER_B_PIN = "8888";

  let ownerASessionToken: string = "";
  let cashierASessionToken: string = "";
  let ownerBSessionToken: string = "";

  beforeAll(async () => {
    server = http.createServer(app);
    realtimeService.attach(server);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as any;
        const port = address.port;
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 1. Seed global tenant registry
    const globalTenants = await getGlobalTenantsList();
    const existing = new Set(globalTenants.map((t) => t.tenantId));

    if (!existing.has(TENANT_A)) {
      globalTenants.push({
        id: `t-${TENANT_A}`,
        name: "Restaurant Alpha",
        tenantId: TENANT_A,
        status: "active",
        created: "2026-09-01",
        region: "Delhi NCR",
        ownerName: "Alpha Owner",
        email: "alpha@example.com"
      });
    }

    if (!existing.has(TENANT_B)) {
      globalTenants.push({
        id: `t-${TENANT_B}`,
        name: "Restaurant Beta",
        tenantId: TENANT_B,
        status: "active",
        created: "2026-09-01",
        region: "Mumbai",
        ownerName: "Beta Owner",
        email: "beta@example.com"
      });
    }

    await saveGlobalTenantsList(globalTenants);

    const defaultSettings = {
      autoDeductStock: true,
      blockOrdersIfInsufficient: true,
      managerCanAddPurchases: true,
      managerCanEditRecipes: true,
      kdsSoundAlerts: false,
      quickPinRequired: false
    };
    await settingsRepo.save(TENANT_A, defaultSettings);
    await settingsRepo.save(TENANT_B, defaultSettings);

    // 2. Seed Staff for A and B
    await staffRepo.saveAll(TENANT_A, [
      {
        id: "usr-owner-a",
        name: "Owner Alice (A)",
        role: "Owner" as any,
        pin: await hashPin(OWNER_A_PIN),
        permissions: ["billing", "inventory", "reports", "settings", "staff", "orders"]
      },
      {
        id: "usr-cashier-a",
        name: "Cashier Bob (A)",
        role: "Cashier" as any,
        pin: await hashPin(CASHIER_A_PIN),
        permissions: ["orders"]
      }
    ]);

    await staffRepo.saveAll(TENANT_B, [
      {
        id: "usr-owner-b",
        name: "Owner Charlie (B)",
        role: "Owner" as any,
        pin: await hashPin(OWNER_B_PIN),
        permissions: ["billing", "inventory", "reports", "settings", "staff", "orders"]
      }
    ]);

    // 3. Seed Restaurant B business data
    await orderRepo.saveAll(TENANT_B, [
      {
        id: "ord-b-101",
        orderNumber: "B-101",
        customerName: "Secret VIP Beta Customer",
        items: [{ menuItemId: "m-1", name: "Secret Dish B", price: 500, quantity: 2, total: 1000 }],
        subtotal: 1000,
        tax: 50,
        total: 1050,
        status: "Completed",
        paymentMethod: "UPI",
        paymentStatus: "Paid",
        date: new Date().toISOString()
      } as any
    ]);

    await customerRepo.saveAll(TENANT_B, [
      {
        id: "cust-b-201",
        name: "Beta High Net Worth VIP",
        phone: "9988776655",
        email: "vip@beta.com",
        loyaltyPoints: 500,
        tier: "Platinum",
        totalSpend: 50000
      } as any
    ]);

    await ingredientRepo.saveAll(TENANT_B, [
      {
        id: "ing-b-401",
        name: "Special Saffron Secret",
        currentStock: 25,
        minStock: 5,
        unit: "gm",
        costPerUnit: 200
      } as any
    ]);

    // 4. Seed Restaurant A order
    await orderRepo.saveAll(TENANT_A, [
      {
        id: "ord-a-001",
        orderNumber: "A-001",
        customerName: "Alpha Customer",
        items: [{ menuItemId: "m-1", name: "Paneer Dish", price: 300, quantity: 1, total: 300 }],
        subtotal: 300,
        tax: 15,
        total: 315,
        status: "Completed",
        paymentMethod: "Cash",
        paymentStatus: "Paid",
        date: new Date().toISOString()
      } as any
    ]);

    // Publish event for Tenant B in EventBus
    eventBus.publish(TENANT_B, "ORDER_COMPLETE", { orderId: "ord-b-101", tenantId: TENANT_B, secret: "beta-data" });
    eventBus.publish(TENANT_A, "ORDER_COMPLETE", { orderId: "ord-a-001", tenantId: TENANT_A, public: "alpha-data" });

    // 5. Authenticate sessions via API login
    const loginOwnerA = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_A, pin: OWNER_A_PIN })
    });
    const resOwnerA = await loginOwnerA.json();
    expect(resOwnerA.success).toBe(true);
    ownerASessionToken = resOwnerA.session.sessionId;

    const loginCashierA = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_A, pin: CASHIER_A_PIN })
    });
    const resCashierA = await loginCashierA.json();
    expect(resCashierA.success).toBe(true);
    cashierASessionToken = resCashierA.session.sessionId;

    const loginOwnerB = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_B, pin: OWNER_B_PIN })
    });
    const resOwnerB = await loginOwnerB.json();
    expect(resOwnerB.success).toBe(true);
    ownerBSessionToken = resOwnerB.session.sessionId;
  });

  afterAll(async () => {
    realtimeService.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // ==========================================================================
  // SECTION 1: CROSS-TENANT READ ATTEMPTS BY RESTAURANT A INTO RESTAURANT B
  // ==========================================================================

  describe("Cross-Tenant Read Isolation", () => {
    it("GET B order: Restaurant A attempting to GET order of Restaurant B must return 404 NOT_FOUND", async () => {
      const response = await fetch(`${serverUrl}/api/orders/ord-b-101`, {
        method: "GET",
        headers: {
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect([403, 404]).toContain(response.status);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
    });

    it("GET B customer: Restaurant A attempting to GET customer of Restaurant B must return 404 NOT_FOUND", async () => {
      const response = await fetch(`${serverUrl}/api/customers/cust-b-201`, {
        method: "GET",
        headers: {
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect([403, 404]).toContain(response.status);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
    });

    it("GET B staff: Restaurant A attempting to GET staff of Restaurant B must return 404 NOT_FOUND", async () => {
      const response = await fetch(`${serverUrl}/api/staff/usr-owner-b`, {
        method: "GET",
        headers: {
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect([403, 404]).toContain(response.status);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
    });

    it("GET B inventory: Restaurant A attempting to GET inventory ingredient of Restaurant B must return 404 NOT_FOUND", async () => {
      const response = await fetch(`${serverUrl}/api/ingredients/ing-b-401`, {
        method: "GET",
        headers: {
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect([403, 404]).toContain(response.status);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.data).toBeUndefined();
    });

    it("GET B report/events: Restaurant A calling /api/events must NEVER see events from Restaurant B", async () => {
      const response = await fetch(`${serverUrl}/api/events`, {
        method: "GET",
        headers: {
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      const betaEvents = body.history.filter((e: any) => e.tenantId === TENANT_B);
      expect(betaEvents.length).toBe(0);
      for (const e of body.history) {
        expect(e.tenantId).toBe(TENANT_A);
      }
    });

    it("Staff directory isolation: Restaurant A session cannot inspect Restaurant B staff directory", async () => {
      const response = await fetch(`${serverUrl}/api/auth/staff-directory?tenantId=${TENANT_B}`, {
        method: "GET",
        headers: {
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Tenant spoofing: Restaurant A session with x-tenant-id header set to Restaurant B is rejected with 403 TENANT_MISMATCH", async () => {
      const response = await fetch(`${serverUrl}/api/orders`, {
        method: "GET",
        headers: {
          "x-session-id": ownerASessionToken,
          "x-tenant-id": TENANT_B,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("TENANT_MISMATCH");
    });
  });

  // ==========================================================================
  // SECTION 2: CROSS-TENANT MUTATION AND DELETION BY RESTAURANT A
  // ==========================================================================

  describe("Cross-Tenant Mutation and Deletion Isolation", () => {
    it("UPDATE B order: Restaurant A attempting to update Restaurant B's order must be rejected (403 or 404)", async () => {
      const response = await fetch(`${serverUrl}/api/orders/ord-b-101`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        },
        body: JSON.stringify({
          id: "ord-b-101",
          total: 0,
          customerName: "Hacked by Tenant A"
        })
      });

      expect([403, 404]).toContain(response.status);

      // Verify B's order was untouched in Restaurant B's database
      const orderB = await orderRepo.getById(TENANT_B, "ord-b-101");
      expect(orderB).toBeDefined();
      expect(orderB?.total).toBe(1050);
      expect(orderB?.customerName).toBe("Secret VIP Beta Customer");
    });

    it("DELETE B order: Restaurant A attempting to delete Restaurant B's order must return 404 NOT_FOUND", async () => {
      const response = await fetch(`${serverUrl}/api/orders/ord-b-101`, {
        method: "DELETE",
        headers: {
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect([403, 404]).toContain(response.status);

      // Verify B's order still exists
      const orderB = await orderRepo.getById(TENANT_B, "ord-b-101");
      expect(orderB).toBeDefined();
      expect(orderB?.id).toBe("ord-b-101");
    });

    it("UPDATE B customer: Restaurant A attempting to update Restaurant B's customer must be rejected (403 or 404)", async () => {
      const response = await fetch(`${serverUrl}/api/customers/cust-b-201`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        },
        body: JSON.stringify({
          id: "cust-b-201",
          name: "Stolen Customer Identity"
        })
      });

      expect([403, 404]).toContain(response.status);

      // Verify B's customer was untouched
      const customerB = await customerRepo.getById(TENANT_B, "cust-b-201");
      expect(customerB).toBeDefined();
      expect(customerB?.name).toBe("Beta High Net Worth VIP");
    });

    it("DELETE B customer: Restaurant A attempting to delete Restaurant B's customer must return 404 NOT_FOUND", async () => {
      const response = await fetch(`${serverUrl}/api/customers/cust-b-201`, {
        method: "DELETE",
        headers: {
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        }
      });

      expect([403, 404]).toContain(response.status);

      // Verify B's customer still exists
      const customerB = await customerRepo.getById(TENANT_B, "cust-b-201");
      expect(customerB).toBeDefined();
      expect(customerB?.id).toBe("cust-b-201");
    });

    it("RLS Defense-in-Depth: Staging payload with conflicting tenant_id under active session is rejected with 403 CROSS_TENANT_VIOLATION", async () => {
      const response = await fetch(`${serverUrl}/api/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": ownerASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${ownerASessionToken}`
        },
        body: JSON.stringify({
          id: "cust-trojan-1",
          tenant_id: TENANT_B, // Trying to inject into Tenant B
          name: "Trojan Record"
        })
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("CROSS_TENANT_VIOLATION");
    });
  });

  // ==========================================================================
  // SECTION 3: SERVER-SIDE RBAC PRIVILEGE ESCALATION PREVENTION
  // ==========================================================================

  describe("Server-Side RBAC Enforcement", () => {
    it("Cashier cannot access /api/jobs (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/jobs`, {
        method: "GET",
        headers: {
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot trigger background jobs via /api/jobs/trigger (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/jobs/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        },
        body: JSON.stringify({ jobId: "job-1" })
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot toggle background jobs via /api/jobs/toggle (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/jobs/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        },
        body: JSON.stringify({ jobId: "job-1", enabled: false })
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot clear job logs via /api/jobs/clear-logs (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/jobs/clear-logs`, {
        method: "POST",
        headers: {
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot trigger Redis flush via /api/monitoring/redis-flush (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/monitoring/redis-flush`, {
        method: "POST",
        headers: {
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot view database backups via /api/monitoring/backups (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/monitoring/backups`, {
        method: "GET",
        headers: {
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot clear system events via /api/events/clear (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/events/clear`, {
        method: "POST",
        headers: {
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot create billing checkout sessions (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/billing/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        },
        body: JSON.stringify({ plan: "pro" })
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot delete orders directly without Manager/Owner role (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/orders/ord-a-001`, {
        method: "DELETE",
        headers: {
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("Cashier cannot add staff members without Manager/Owner role (expects 403 FORBIDDEN)", async () => {
      const response = await fetch(`${serverUrl}/api/staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": cashierASessionToken,
          Cookie: `${SESSION_COOKIE_NAME}=${cashierASessionToken}`
        },
        body: JSON.stringify({
          id: "usr-new-intruder",
          name: "Fake Admin",
          role: "Owner",
          pin: "9999"
        })
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("FORBIDDEN");
    });
  });
});
