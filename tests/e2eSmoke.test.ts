import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import WebSocket from "ws";
import { app } from "../server";
import {
  staffRepo,
  orderRepo,
  settingsRepo,
  getGlobalTenantsList,
  saveGlobalTenantsList,
  realtimeService
} from "../server/context";
import { Database } from "../server/features/shared/database";
import { hashPin } from "../server/features/auth/PinSecurityService";
import { SESSION_COOKIE_NAME } from "../server/features/auth/SessionService";

describe("End-to-End Smoke Tests: Multi-Tenant Lifecycle, Security & Realtime Isolation", () => {
  let server: http.Server;
  let serverUrl: string;
  let wsUrl: string;

  const TENANT_T1 = "tenant-t1-smoke";
  const TENANT_T2 = "tenant-t2-smoke";
  const OWNER_T1_PIN = "1111";
  const CASHIER_T2_PIN = "2222";

  let ownerT1SessionToken: string = "";
  let cashierT2SessionToken: string = "";

  beforeAll(async () => {
    // 1. Initialize HTTP and WebSocket server for live network testing
    server = http.createServer(app);
    realtimeService.attach(server);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as any;
        const port = address.port;
        serverUrl = `http://127.0.0.1:${port}`;
        wsUrl = `ws://127.0.0.1:${port}/ws`;
        resolve();
      });
    });

    // 2. Register Tenants T1 and T2 in Global Tenants List
    const globalTenants = await getGlobalTenantsList();
    const existingIds = new Set(globalTenants.map((t) => t.tenantId));

    if (!existingIds.has(TENANT_T1)) {
      globalTenants.push({
        id: `t-${TENANT_T1}`,
        name: "Veggie Bistro Flagship (T1)",
        tenantId: TENANT_T1,
        status: "active",
        created: "2026-09-24",
        region: "North India / Delhi",
        ownerName: "Owner T1",
        email: "owner-t1@veggiebistro.com"
      });
    }

    if (!existingIds.has(TENANT_T2)) {
      globalTenants.push({
        id: `t-${TENANT_T2}`,
        name: "Veggie Express Outpost (T2)",
        tenantId: TENANT_T2,
        status: "active",
        created: "2026-09-24",
        region: "North India / Delhi",
        ownerName: "Owner T2",
        email: "owner-t2@veggieexpress.com"
      });
    }

    await saveGlobalTenantsList(globalTenants);

    // 3. Initialize Settings for T1 and T2
    const defaultSettings = {
      autoDeductStock: true,
      blockOrdersIfInsufficient: true,
      managerCanAddPurchases: true,
      managerCanEditRecipes: true,
      kdsSoundAlerts: false,
      quickPinRequired: false
    };
    await settingsRepo.save(TENANT_T1, defaultSettings);
    await settingsRepo.save(TENANT_T2, defaultSettings);

    // 4. Create Owner user in T1 and Cashier user in T2
    const hashedOwnerPin = await hashPin(OWNER_T1_PIN);
    const hashedCashierPin = await hashPin(CASHIER_T2_PIN);

    await staffRepo.saveAll(TENANT_T1, [
      {
        id: "usr-owner-t1",
        name: "Vikram Rathore (Owner T1)",
        role: "Owner" as any,
        pin: hashedOwnerPin,
        permissions: ["billing", "inventory", "reports", "settings", "staff", "orders"]
      },
      {
        id: "usr-chef-t1",
        name: "Ramesh Chef (T1)",
        role: "Chef" as any,
        pin: await hashPin("3333"),
        permissions: ["orders"]
      }
    ]);

    await staffRepo.saveAll(TENANT_T2, [
      {
        id: "usr-cashier-t2",
        name: "Sunita Cashier (T2)",
        role: "Cashier" as any,
        pin: hashedCashierPin,
        permissions: ["billing", "orders"]
      }
    ]);
  });

  afterAll(async () => {
    // Ensure DB is resumed
    Database.getInstance().resumeDatabase();
    realtimeService.close();

    await new Promise<void>((resolve) => {
      if ((server as any).closeAllConnections) {
        (server as any).closeAllConnections();
      }
      server.close(() => resolve());
    });
  });

  it("Step 1: Should login as Owner T1, receive valid session token, and create an order", async () => {
    // 1. Login as Owner T1
    const loginRes = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: TENANT_T1,
        pin: OWNER_T1_PIN
      })
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.user.role).toBe("Owner");
    expect(loginData.session.tenantId).toBe(TENANT_T1);

    // Extract session token
    ownerT1SessionToken = loginData.session.sessionId;
    expect(ownerT1SessionToken).toBeTruthy();

    // 2. Create Order in Tenant T1 using Owner session
    const orderPayload = {
      id: "ord-smoke-101",
      customerName: "Rohan Verma",
      tableNumber: "T-4",
      total: 440,
      paymentMethod: "UPI",
      status: "Completed",
      date: new Date().toISOString(),
      items: [
        {
          menuItemId: "m-thali",
          name: "Special Thali",
          quantity: 2,
          price: 220
        }
      ]
    };

    const orderRes = await fetch(`${serverUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerT1SessionToken}`,
        "Cookie": `${SESSION_COOKIE_NAME}=${ownerT1SessionToken}`
      },
      body: JSON.stringify(orderPayload)
    });

    expect(orderRes.status).toBe(200);
    const orderData = await orderRes.json();
    expect(orderData.success).toBe(true);
    expect(orderData.message).toBe("Order placed successfully.");

    // 3. Verify DB Row exists and is committed to storage
    const committedOrder = await orderRepo.getById(TENANT_T1, "ord-smoke-101");
    expect(committedOrder).not.toBeNull();
    expect(committedOrder?.id).toBe("ord-smoke-101");
    expect(committedOrder?.total).toBe(440);
    expect(committedOrder?.status).toBe("Completed");
    expect(committedOrder?.customerName).toBe("Rohan Verma");
    expect((committedOrder as any)?.version).toBe(1);
  });

  it("Step 2: Should login as Cashier T2 and attempt to read T1 staff directory — expect 403 Forbidden", async () => {
    // 1. Login as Cashier T2
    const loginRes = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: TENANT_T2,
        pin: CASHIER_T2_PIN
      })
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.success).toBe(true);
    expect(loginData.user.role).toBe("Cashier");
    expect(loginData.session.tenantId).toBe(TENANT_T2);

    cashierT2SessionToken = loginData.session.sessionId;
    expect(cashierT2SessionToken).toBeTruthy();

    // 2. Attempt to read T1 staff directory via query parameter ?tenantId=tenant-t1-smoke
    const queryDirRes = await fetch(`${serverUrl}/api/auth/staff-directory?tenantId=${TENANT_T1}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cashierT2SessionToken}`,
        "Cookie": `${SESSION_COOKIE_NAME}=${cashierT2SessionToken}`
      }
    });

    expect(queryDirRes.status).toBe(403);
    const queryDirData = await queryDirRes.json();
    expect(queryDirData.success).toBe(false);
    expect(queryDirData.error).toBe("FORBIDDEN");

    // 3. Attempt to read T1 staff directory via header x-tenant-id: tenant-t1-smoke
    const headerDirRes = await fetch(`${serverUrl}/api/auth/staff-directory`, {
      method: "GET",
      headers: {
        "x-tenant-id": TENANT_T1,
        "Authorization": `Bearer ${cashierT2SessionToken}`,
        "Cookie": `${SESSION_COOKIE_NAME}=${cashierT2SessionToken}`
      }
    });

    expect(headerDirRes.status).toBe(403);
    const headerDirData = await headerDirRes.json();
    expect(headerDirData.success).toBe(false);

    // 4. Attempt to read /api/staff with spoofed header x-tenant-id: tenant-t1-smoke
    const staffRouteRes = await fetch(`${serverUrl}/api/staff`, {
      method: "GET",
      headers: {
        "x-tenant-id": TENANT_T1,
        "Authorization": `Bearer ${cashierT2SessionToken}`,
        "Cookie": `${SESSION_COOKIE_NAME}=${cashierT2SessionToken}`
      }
    });

    expect(staffRouteRes.status).toBe(403);
    const staffRouteData = await staffRouteRes.json();
    expect(staffRouteData.success).toBe(false);
    // Anti-spoofing middleware catches mismatch
    expect(staffRouteData.error).toBe("TENANT_MISMATCH");
  });

  it("Step 3: Should stop DB and reject write attempts with HTTP 503 DATABASE_UNAVAILABLE", async () => {
    const db = Database.getInstance();

    // 1. Simulate DB outage / stopped state
    db.stopDatabase();
    expect(db.isDatabaseStopped()).toBe(true);

    try {
      // 2. Attempt to write order while DB is stopped
      const failingOrderPayload = {
        id: "ord-fail-503",
        customerName: "Downtime Order",
        total: 180,
        status: "Completed",
        date: new Date().toISOString(),
        items: []
      };

      const failRes = await fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerT1SessionToken}`,
          "Cookie": `${SESSION_COOKIE_NAME}=${ownerT1SessionToken}`
        },
        body: JSON.stringify(failingOrderPayload)
      });

      expect(failRes.status).toBe(503);
      const failData = await failRes.json();
      expect(failData.success).toBe(false);
      expect(failData.error).toBe("DATABASE_UNAVAILABLE");
      expect(failData.message).toContain("Database is unavailable");

      // Verify the failing row was NOT written to database
      const row = await orderRepo.getById(TENANT_T1, "ord-fail-503");
      expect(row).toBeNull();
    } finally {
      // 3. Resume Database and verify recovery
      db.resumeDatabase();
      expect(db.isDatabaseStopped()).toBe(false);
    }

    // 4. Verify writes succeed after DB resume
    const recoveredOrderPayload = {
      id: "ord-recovered-200",
      customerName: "Recovered Order",
      total: 250,
      status: "Completed",
      date: new Date().toISOString(),
      items: []
    };

    const recoverRes = await fetch(`${serverUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerT1SessionToken}`,
        "Cookie": `${SESSION_COOKIE_NAME}=${ownerT1SessionToken}`
      },
      body: JSON.stringify(recoveredOrderPayload)
    });

    expect(recoverRes.status).toBe(200);
    const recoverData = await recoverRes.json();
    expect(recoverData.success).toBe(true);

    const verifiedRecovered = await orderRepo.getById(TENANT_T1, "ord-recovered-200");
    expect(verifiedRecovered).not.toBeNull();
    expect(verifiedRecovered?.id).toBe("ord-recovered-200");
  });

  it("Step 4: Should enforce real-time WebSocket cross-tenant isolation and ignore client channel spoofing", async () => {
    // 1. Establish WebSocket for Owner T1
    const wsT1 = new WebSocket(`${wsUrl}?token=${ownerT1SessionToken}`);
    const messagesT1: any[] = [];

    await new Promise<void>((resolve, reject) => {
      wsT1.on("open", () => resolve());
      wsT1.on("error", reject);
      wsT1.on("message", (raw) => {
        messagesT1.push(JSON.parse(raw.toString()));
      });
    });

    // 2. Establish WebSocket for Cashier T2
    const wsT2 = new WebSocket(`${wsUrl}?token=${cashierT2SessionToken}`);
    const messagesT2: any[] = [];

    await new Promise<void>((resolve, reject) => {
      wsT2.on("open", () => resolve());
      wsT2.on("error", reject);
      wsT2.on("message", (raw) => {
        messagesT2.push(JSON.parse(raw.toString()));
      });
    });

    // Wait for connection:ready handshakes
    await new Promise((r) => setTimeout(r, 100));

    expect(messagesT1.length).toBeGreaterThanOrEqual(1);
    expect(messagesT1[0].type).toBe("connection:ready");
    expect(messagesT1[0].tenantId).toBe(TENANT_T1);

    expect(messagesT2.length).toBeGreaterThanOrEqual(1);
    expect(messagesT2[0].type).toBe("connection:ready");
    expect(messagesT2[0].tenantId).toBe(TENANT_T2);

    // Clear initial handshake messages
    messagesT1.length = 0;
    messagesT2.length = 0;

    // 3. Cashier T2 attempts channel spoofing: client declares channel "public:tenant-t1-smoke"
    wsT2.send(JSON.stringify({ channel: `public:${TENANT_T1}`, tenantId: TENANT_T1 }));
    await new Promise((r) => setTimeout(r, 50));

    // 4. Server broadcasts an order completion event strictly to Tenant T1
    realtimeService.broadcastToTenant(TENANT_T1, "order:completed", {
      slice: "orders",
      entityId: "ord-smoke-101"
    });

    // Wait for network message propagation
    await new Promise((r) => setTimeout(r, 100));

    // 5. Verify Owner T1 received the event
    expect(messagesT1.length).toBe(1);
    expect(messagesT1[0]).toEqual({
      type: "order:completed",
      tenantId: TENANT_T1,
      slice: "orders",
      entityId: "ord-smoke-101",
      timestamp: expect.any(Number)
    });

    // 6. Verify Cashier T2 DID NOT receive the event (STRICT ISOLATION)
    expect(messagesT2.length).toBe(0);

    // 7. Clean up WebSocket connections
    wsT1.close();
    wsT2.close();
  });
});
