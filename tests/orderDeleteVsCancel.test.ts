import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { app } from "../server";
import { Database } from "../server/features/shared/database";
import {
  staffRepo,
  orderRepo,
  ingredientRepo,
  recipeRepo,
  auditLogService,
  realtimeService,
  getGlobalTenantsList,
  saveGlobalTenantsList,
  financialTransactionService
} from "../server/context";
import { OrderDeletionProhibitedError } from "../server/features/pos/OrderRepository";
import { hashPin } from "../server/features/auth/PinSecurityService";
import { MenuItem, Ingredient, Recipe, Order } from "../src/features/shared/types";
import { MenuRepository } from "../server/features/pos/MenuRepository";
import { SettingsRepository } from "../server/features/shared/SettingsRepository";

describe("Order Delete vs Order Cancel (Direct Delete Endpoint Bug Resolution)", () => {
  const TENANT_A = "tenant-order-del-a";
  const TENANT_B = "tenant-order-del-b";
  const OWNER_PIN = "1111";
  const CASHIER_PIN = "2222";

  let server: http.Server;
  let serverUrl: string;
  let ownerToken: string = "";
  let cashierToken: string = "";

  let db: Database;
  let menuRepo: MenuRepository;
  let settingsRepo: SettingsRepository;

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
        name: "Order Integrity Bistro",
        tenantId: TENANT_A,
        status: "active",
        created: "2026-10-01",
        region: "North India",
        ownerName: "Vikram Owner",
        email: "owner@order-integrity.com"
      });
    }
    if (!existingIds.has(TENANT_B)) {
      globalTenants.push({
        id: `t-${TENANT_B}`,
        name: "Alien Cafe",
        tenantId: TENANT_B,
        status: "active",
        created: "2026-10-01",
        region: "West India",
        ownerName: "Alien Owner",
        email: "alien@cafe.com"
      });
    }
    await saveGlobalTenantsList(globalTenants);
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
    (db as any).objectsByTenant[TENANT_A] = {};
    (db as any).tablesByTenant[TENANT_B] = {};
    (db as any).objectsByTenant[TENANT_B] = {};

    menuRepo = new MenuRepository();
    settingsRepo = new SettingsRepository();

    await settingsRepo.save(TENANT_A, {
      autoDeductStock: true,
      blockOrdersIfInsufficient: true,
      gstPercentage: 5
    } as any);

    // Seed Staff
    await staffRepo.saveAll(TENANT_A, [
      {
        id: "usr-owner-a",
        name: "Vikram Owner",
        role: "Owner" as any,
        pin: await hashPin(OWNER_PIN),
        permissions: ["billing", "inventory", "reports", "settings", "staff", "orders"]
      },
      {
        id: "usr-cashier-a",
        name: "Sunil Cashier",
        role: "Cashier" as any,
        pin: await hashPin(CASHIER_PIN),
        permissions: ["billing"]
      }
    ]);

    // Authenticate Owner
    const ownerRes = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_A, pin: OWNER_PIN })
    });
    const ownerData = await ownerRes.json();
    ownerToken = ownerData.session.sessionId;

    // Authenticate Cashier
    const cashierRes = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_A, pin: CASHIER_PIN })
    });
    const cashierData = await cashierRes.json();
    cashierToken = cashierData.session.sessionId;

    // Seed Menu Items
    await menuRepo.saveAll(TENANT_A, [
      {
        id: "dish-paneer-tikka",
        name: "Paneer Tikka",
        price: 300,
        category: "Starters",
        imageUrl: "🍢",
        isVegetarian: true,
        isAvailable: true,
        tenantId: TENANT_A
      } as any
    ]);

    // Seed Ingredients (Paneer: 5 kg stock)
    await ingredientRepo.saveAll(TENANT_A, [
      {
        id: "ing-paneer",
        name: "Fresh Paneer",
        unit: "kg",
        currentStock: 5.0,
        minStock: 1.0,
        costPerUnit: 400
      }
    ]);

    // Seed Recipe: 1 portion uses 250 g (0.25 kg)
    await recipeRepo.saveAll(TENANT_A, [
      {
        menuItemId: "dish-paneer-tikka",
        ingredients: [
          { ingredientId: "ing-paneer", quantity: 250, unit: "g" }
        ]
      }
    ]);
  });

  describe("Repository Level Hard-Delete Protection", () => {
    it("should reject orderRepo.delete() with OrderDeletionProhibitedError to protect fiscal records", async () => {
      await expect(
        orderRepo.delete(TENANT_A, "ord-any-id")
      ).rejects.toThrow(OrderDeletionProhibitedError);
    });
  });

  describe("DELETE /api/orders/:id Endpoint Authorization & Cross-Tenant Isolation", () => {
    it("should reject Cashier attempting DELETE /api/orders/:id with 403 FORBIDDEN", async () => {
      const res = await fetch(`${serverUrl}/api/orders/ord-test-1`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${cashierToken}`,
          "Content-Type": "application/json"
        }
      });
      expect(res.status).toBe(403);
    });

    it("should reject DELETE for non-existent order with 404 NOT_FOUND", async () => {
      const res = await fetch(`${serverUrl}/api/orders/ord-ghost-item`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        }
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("NOT_FOUND");
    });

    it("should reject cross-tenant deletion attempts with 404 NOT_FOUND", async () => {
      // Seed Order in Tenant B
      await ((orderRepo as any).purge(TENANT_B, "ord-b-alien").catch(() => {}));
      (db as any).tablesByTenant[TENANT_B] = {
        orders: [
          { id: "ord-b-alien", orderNumber: "B999", tenantId: TENANT_B, total: 500, status: "Pending" }
        ]
      };

      // Tenant A attempts to delete Tenant B's order
      const res = await fetch(`${serverUrl}/api/orders/ord-b-alien`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        }
      });
      expect(res.status).toBe(404);

      // Verify B's order still exists
      const orderB = await orderRepo.getById(TENANT_B, "ord-b-alien");
      expect(orderB).toBeDefined();
      expect(orderB?.id).toBe("ord-b-alien");
    });
  });

  describe("DELETE /api/orders/:id Business Logic & State Preservation", () => {
    it("should NOT purge the order from DB, but transition to 'Cancelled', restock inventory, and refund payments", async () => {
      // 1. Place an order for 2 portions of Paneer Tikka (deducts 500g = 0.5kg)
      const placement = await financialTransactionService.executeOrderPlacement(TENANT_A, {
        id: "ord-to-be-cancelled",
        orderNumber: "1001",
        customerName: "Rahul",
        items: [{ menuItemId: "dish-paneer-tikka", quantity: 2 }],
        status: "Pending"
      } as any);

      // Verify initial deduction: 5.0kg - 0.5kg = 4.5kg
      const paneerAfterPlacement = await ingredientRepo.getById(TENANT_A, "ing-paneer");
      expect(paneerAfterPlacement?.currentStock).toBe(4.5);

      // Also record payment of ₹630 (300*2 + 5% GST)
      await financialTransactionService.executeOrderPayment(TENANT_A, "ord-to-be-cancelled", {
        amount: 630,
        paymentMethod: "UPI"
      });

      // 2. Call DELETE /api/orders/ord-to-be-cancelled with a reason
      const deleteRes = await fetch(`${serverUrl}/api/orders/ord-to-be-cancelled`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reason: "Customer had to leave immediately for emergency",
          cancelledBy: "Vikram Owner"
        })
      });

      expect(deleteRes.status).toBe(200);
      const deleteData = await deleteRes.json();
      expect(deleteData.success).toBe(true);
      expect(deleteData.message).toContain("successfully voided and cancelled");

      // 3. CRITICAL CHECK: Order must STILL EXIST in the database (not deleted!)
      const preservedOrder = await orderRepo.getById(TENANT_A, "ord-to-be-cancelled");
      expect(preservedOrder).toBeDefined();
      expect(preservedOrder?.id).toBe("ord-to-be-cancelled");
      expect(preservedOrder?.status).toBe("Cancelled");
      expect((preservedOrder as any)?.cancellationReason).toBe("Customer had to leave immediately for emergency");
      expect((preservedOrder as any)?.cancelledBy).toBe("Vikram Owner");

      // 4. CRITICAL CHECK: Inventory must be RESTOCKED back to 5.0 kg!
      const paneerAfterDelete = await ingredientRepo.getById(TENANT_A, "ing-paneer");
      expect(paneerAfterDelete?.currentStock).toBe(5.0);

      // 5. CRITICAL CHECK: Payment must be marked 'Refunded'
      const payments = await financialTransactionService.getPaymentRepo().getAll(TENANT_A);
      const orderPayment = payments?.find(p => p.orderId === "ord-to-be-cancelled");
      expect(orderPayment).toBeDefined();
      expect(orderPayment?.status).toBe("Refunded");

      // 6. CRITICAL CHECK: Audit Log must have an entry for ORDER_CANCELLED
      const logs = await auditLogService.getLogs(TENANT_A);
      const cancelLog = logs.find(l => l.eventType === "ORDER_CANCELLED" && l.details?.orderId === "ord-to-be-cancelled");
      expect(cancelLog).toBeDefined();
      expect(cancelLog?.details?.reason).toContain("emergency");
    });

    it("should reject DELETE on an already cancelled order with 400 ORDER_ALREADY_CANCELLED", async () => {
      // 1. Place order
      await financialTransactionService.executeOrderPlacement(TENANT_A, {
        id: "ord-double-cancel",
        orderNumber: "1002",
        items: [{ menuItemId: "dish-paneer-tikka", quantity: 1 }],
        status: "Pending"
      } as any);

      // 2. First DELETE succeeds
      const firstRes = await fetch(`${serverUrl}/api/orders/ord-double-cancel`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        }
      });
      expect(firstRes.status).toBe(200);

      // 3. Second DELETE returns 400 ORDER_ALREADY_CANCELLED
      const secondRes = await fetch(`${serverUrl}/api/orders/ord-double-cancel`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        }
      });
      expect(secondRes.status).toBe(400);
      const secondData = await secondRes.json();
      expect(secondData.error).toBe("ORDER_ALREADY_CANCELLED");
    });
  });

  describe("Offline Outbox Sync with operationType='DELETE'", () => {
    it("should safely convert offline DELETE operations into cancellations with stock restock", async () => {
      // 1. Create order
      await financialTransactionService.executeOrderPlacement(TENANT_A, {
        id: "ord-offline-void",
        orderNumber: "1003",
        items: [{ menuItemId: "dish-paneer-tikka", quantity: 2 }],
        status: "Pending"
      } as any);

      // Verify stock was reduced to 4.5kg
      expect((await ingredientRepo.getById(TENANT_A, "ing-paneer"))?.currentStock).toBe(4.5);

      // 2. Simulate offline outbox sync carrying a DELETE operation
      const outboxPayload = {
        operationId: "op-void-1003",
        operationType: "DELETE",
        entityType: "order",
        entityId: "ord-offline-void",
        payload: {
          cancelledBy: "Offline Terminal 1",
          reason: "Accidental punch during rush hour"
        }
      };

      const syncRes = await fetch(`${serverUrl}/api/sync/outbox`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(outboxPayload)
      });

      expect(syncRes.status).toBe(200);
      const syncData = await syncRes.json();
      expect(syncData.success).toBe(true);

      // Order must be preserved as Cancelled
      const order = await orderRepo.getById(TENANT_A, "ord-offline-void");
      expect(order).toBeDefined();
      expect(order?.status).toBe("Cancelled");

      // Stock must be restocked to 5.0kg
      expect((await ingredientRepo.getById(TENANT_A, "ing-paneer"))?.currentStock).toBe(5.0);
    });
  });
});
