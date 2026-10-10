import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { app } from "../server";
import { Database } from "../server/features/shared/database";
import {
  staffRepo,
  orderRepo,
  settingsRepo,
  auditLogService,
  realtimeService,
  getGlobalTenantsList,
  saveGlobalTenantsList
} from "../server/context";
import { posPricingEngine, FinancialValidationError } from "../server/features/pos/POSPricingEngine";
import { hashPin } from "../server/features/auth/PinSecurityService";
import { SessionService } from "../server/features/auth/SessionService";
import { MenuItem, Ingredient, Recipe, Order } from "../src/features/shared/types";
import { MenuRepository } from "../server/features/pos/MenuRepository";

describe("POS Discount Amount Validation Gap Resolution", () => {
  const TENANT_ID = "tenant-pos-discount-test";
  const OWNER_PIN = "1234";
  const MANAGER_PIN = "5678";
  const CASHIER_PIN = "9999";

  let server: http.Server;
  let serverUrl: string;
  let cashierToken: string = "";
  let managerToken: string = "";
  let ownerToken: string = "";

  let db: Database;
  let menuRepo: MenuRepository;

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
    if (!globalTenants.some((t) => t.tenantId === TENANT_ID)) {
      globalTenants.push({
        id: `t-${TENANT_ID}`,
        name: "Discount Policy Bistro",
        tenantId: TENANT_ID,
        status: "active",
        created: "2026-10-01",
        region: "North India",
        ownerName: "Discount Owner",
        email: "owner@discount-test.com"
      });
      await saveGlobalTenantsList(globalTenants);
    }
  });

  afterAll(async () => {
    realtimeService.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(async () => {
    db = Database.getInstance();
    (db as any).tablesByTenant[TENANT_ID] = {};
    (db as any).objectsByTenant[TENANT_ID] = {};
    menuRepo = new MenuRepository();

    // 1. Seed Staff with Hashed PINs
    const ownerHash = await hashPin(OWNER_PIN);
    const managerHash = await hashPin(MANAGER_PIN);
    const cashierHash = await hashPin(CASHIER_PIN);

    await staffRepo.saveAll(TENANT_ID, [
      {
        id: "staff-owner",
        name: "Owner Raj",
        role: "Owner",
        pin: ownerHash,
        phone: "9876543210",
        status: "Active",
        permissions: ["all", "orders", "inventory", "settings", "reports", "apply_discount"]
      },
      {
        id: "staff-manager",
        name: "Manager Priya",
        role: "Manager",
        pin: managerHash,
        phone: "9876543211",
        status: "Active",
        permissions: ["orders", "inventory", "reports", "apply_discount"]
      },
      {
        id: "staff-cashier",
        name: "Cashier Amit",
        role: "Cashier",
        pin: cashierHash,
        phone: "9876543212",
        status: "Active",
        permissions: ["orders"] // No apply_discount permission!
      }
    ]);

    // 2. Set Restaurant Settings with Max 25% discount policy
    await settingsRepo.save(TENANT_ID, {
      autoDeductStock: true,
      blockOrdersIfInsufficient: false,
      managerCanAddPurchases: true,
      managerCanEditRecipes: true,
      kdsSoundAlerts: false,
      quickPinRequired: true,
      gstPercentage: 5,
      maxDiscountPercentage: 25 // 25% Policy ceiling!
    });

    // 3. Seed Menu Items
    await menuRepo.saveAll(TENANT_ID, [
      {
        id: "dish-paneer-butter",
        name: "Paneer Butter Masala",
        price: 300,
        category: "Main Course",
        available: true
      } as any,
      {
        id: "dish-roti",
        name: "Tandoori Roti",
        price: 30,
        category: "Breads",
        available: true
      } as any
    ]);

    // Directly create sessions via SessionService to avoid login rate limiting
    const sessionService = SessionService.getInstance();
    const cashierSession = await sessionService.createSession(
      TENANT_ID,
      "staff-cashier",
      "Cashier Amit",
      "Cashier",
      "127.0.0.1",
      "test-agent",
      ["orders"]
    );
    cashierToken = cashierSession.sessionId;

    const managerSession = await sessionService.createSession(
      TENANT_ID,
      "staff-manager",
      "Manager Priya",
      "Manager",
      "127.0.0.1",
      "test-agent",
      ["orders", "inventory", "reports", "apply_discount"]
    );
    managerToken = managerSession.sessionId;

    const ownerSession = await sessionService.createSession(
      TENANT_ID,
      "staff-owner",
      "Owner Raj",
      "Owner",
      "127.0.0.1",
      "test-agent",
      ["all", "orders", "inventory", "settings", "reports", "apply_discount"]
    );
    ownerToken = ownerSession.sessionId;
  });

  describe("POSPricingEngine Discount Validation & Calculations", () => {
    it("should reject negative discount amount with INVALID_DISCOUNT", async () => {
      const items: any = [{ menuItemId: "dish-paneer-butter", quantity: 1 }];
      await expect(
        posPricingEngine.validateAndCalculateOrder(
          TENANT_ID,
          { items, discount: -50 },
          { role: "Owner" }
        )
      ).rejects.toThrow(FinancialValidationError);

      try {
        await posPricingEngine.validateAndCalculateOrder(
          TENANT_ID,
          { items, discount: -50 },
          { role: "Owner" }
        );
      } catch (err: any) {
        expect(err.code).toBe("INVALID_DISCOUNT");
      }
    });

    it("should reject discount on an empty order with INVALID_DISCOUNT", async () => {
      await expect(
        posPricingEngine.validateAndCalculateOrder(
          TENANT_ID,
          { items: [], discount: 50 },
          { role: "Owner" }
        )
      ).rejects.toThrow(FinancialValidationError);
    });

    it("should reject discount exceeding order total with DISCOUNT_EXCEEDS_TOTAL", async () => {
      // 1 item * ₹300 = ₹300 + 5% GST (₹15) = ₹315
      const items: any = [{ menuItemId: "dish-paneer-butter", quantity: 1 }];
      await expect(
        posPricingEngine.validateAndCalculateOrder(
          TENANT_ID,
          { items, discount: 500 },
          { role: "Owner" }
        )
      ).rejects.toThrow(/exceeds/i);

      try {
        await posPricingEngine.validateAndCalculateOrder(
          TENANT_ID,
          { items, discount: 500 },
          { role: "Owner" }
        );
      } catch (err: any) {
        expect(err.code).toBe("DISCOUNT_EXCEEDS_TOTAL");
      }
    });

    it("should reject discount exceeding restaurant policy max discount percentage", async () => {
      // 1 item * ₹300 = ₹300 + 5% GST = ₹315.
      // Policy is 25%, so max allowable discount is ₹315 * 0.25 = ₹78.75.
      // Requesting ₹100 discount should be rejected with DISCOUNT_EXCEEDS_MAX_PERCENTAGE!
      const items: any = [{ menuItemId: "dish-paneer-butter", quantity: 1 }];
      try {
        await posPricingEngine.validateAndCalculateOrder(
          TENANT_ID,
          { items, discount: 100 },
          { role: "Owner" }
        );
        expect.fail("Should have thrown DISCOUNT_EXCEEDS_MAX_PERCENTAGE");
      } catch (err: any) {
        expect(err.code).toBe("DISCOUNT_EXCEEDS_MAX_PERCENTAGE");
        expect(err.message).toContain("25%");
      }
    });

    it("should accurately calculate and accept valid percentage discount within policy", async () => {
      // 1 item * ₹300 = ₹300 + 5% GST = ₹315.
      // 10% discount = ₹31.50
      const items: any = [{ menuItemId: "dish-paneer-butter", quantity: 1 }];
      const calc = await posPricingEngine.validateAndCalculateOrder(
        TENANT_ID,
        { items, discountPercentage: 10 },
        { role: "Owner" }
      );

      expect(calc.subtotal).toBe(300);
      expect(calc.tax).toBe(15);
      expect(calc.discount).toBe(31.5);
      expect(calc.total).toBe(283.5);
    });

    it("should require Manager/Owner PIN when Cashier without apply_discount attempts discount", async () => {
      const items: any = [{ menuItemId: "dish-paneer-butter", quantity: 1 }];

      // 1. Without PIN -> UNAUTHORIZED_DISCOUNT
      try {
        await posPricingEngine.validateAndCalculateOrder(
          TENANT_ID,
          { items, discount: 50 },
          { role: "Cashier", permissions: ["orders"] }
        );
        expect.fail("Should have thrown UNAUTHORIZED_DISCOUNT");
      } catch (err: any) {
        expect(err.code).toBe("UNAUTHORIZED_DISCOUNT");
      }

      // 2. With wrong PIN -> INVALID_MANAGER_PIN
      try {
        await posPricingEngine.validateAndCalculateOrder(
          TENANT_ID,
          { items, discount: 50, managerPin: "0000" },
          { role: "Cashier", permissions: ["orders"] }
        );
        expect.fail("Should have thrown INVALID_MANAGER_PIN");
      } catch (err: any) {
        expect(err.code).toBe("INVALID_MANAGER_PIN");
      }

      // 3. With valid Manager PIN -> Successfully authorized
      const calc = await posPricingEngine.validateAndCalculateOrder(
        TENANT_ID,
        { items, discount: 50, managerPin: MANAGER_PIN },
        { role: "Cashier", permissions: ["orders"] }
      );
      expect(calc.discount).toBe(50);
      expect(calc.total).toBe(265); // 300 + 15 - 50 = 265
    });
  });

  describe("API Endpoint /api/orders/audit-discount Validation & Audit Logging", () => {
    it("should reject discount request without manager PIN with 401 PIN_REQUIRED", async () => {
      const res = await fetch(`${serverUrl}/api/orders/audit-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cashierToken}`,
          "x-session-id": cashierToken,
          "x-tenant-id": TENANT_ID
        },
        body: JSON.stringify({
          originalAmount: 315,
          discountAmount: 50,
          reason: "Customer Loyalty"
        })
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("PIN_REQUIRED");
    });

    it("should reject negative or zero originalAmount with 400 INVALID_ORIGINAL_AMOUNT", async () => {
      const res = await fetch(`${serverUrl}/api/orders/audit-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cashierToken}`,
          "x-session-id": cashierToken,
          "x-tenant-id": TENANT_ID
        },
        body: JSON.stringify({
          originalAmount: 0,
          discountAmount: 50,
          managerPin: MANAGER_PIN,
          reason: "Customer Loyalty"
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("INVALID_ORIGINAL_AMOUNT");
    });

    it("should reject discount exceeding original amount with 400 DISCOUNT_EXCEEDS_TOTAL", async () => {
      const res = await fetch(`${serverUrl}/api/orders/audit-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cashierToken}`,
          "x-session-id": cashierToken,
          "x-tenant-id": TENANT_ID
        },
        body: JSON.stringify({
          originalAmount: 100,
          discountAmount: 150,
          managerPin: MANAGER_PIN,
          reason: "VIP Guest"
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("DISCOUNT_EXCEEDS_TOTAL");
    });

    it("should reject discount exceeding restaurant policy with 400 DISCOUNT_EXCEEDS_MAX_PERCENTAGE", async () => {
      // Original amount ₹300, max policy 25% (₹75). Requesting ₹80:
      const res = await fetch(`${serverUrl}/api/orders/audit-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cashierToken}`,
          "x-session-id": cashierToken,
          "x-tenant-id": TENANT_ID
        },
        body: JSON.stringify({
          originalAmount: 300,
          discountAmount: 80,
          managerPin: MANAGER_PIN,
          reason: "VIP Guest"
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("DISCOUNT_EXCEEDS_MAX_PERCENTAGE");
    });

    it("should reject invalid Manager PIN with 403 UNAUTHORIZED_PIN", async () => {
      const res = await fetch(`${serverUrl}/api/orders/audit-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cashierToken}`,
          "x-session-id": cashierToken,
          "x-tenant-id": TENANT_ID
        },
        body: JSON.stringify({
          originalAmount: 300,
          discountAmount: 50,
          managerPin: "0000",
          reason: "Special Promo"
        })
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("UNAUTHORIZED_PIN");
    });

    it("should reject discount on a cancelled order with 400 ORDER_CANCELLED", async () => {
      // Seed a cancelled order
      const cancelledOrder: Order = {
        id: "ord-cancelled-for-discount",
        orderNumber: "7771",
        date: new Date().toISOString(),
        type: "Dine-In",
        items: [],
        subtotal: 200,
        tax: 10,
        total: 210,
        status: "Cancelled",
        cashierId: "staff-cashier",
        cashierName: "Cashier Amit"
      };
      await orderRepo.save(TENANT_ID, cancelledOrder);

      const res = await fetch(`${serverUrl}/api/orders/audit-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cashierToken}`,
          "x-session-id": cashierToken,
          "x-tenant-id": TENANT_ID
        },
        body: JSON.stringify({
          orderId: "ord-cancelled-for-discount",
          originalAmount: 210,
          discountAmount: 30,
          managerPin: MANAGER_PIN,
          reason: "Post-cancel discount attempt"
        })
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("ORDER_CANCELLED");
    });

    it("should authoritatively approve valid discount, log audit entry, and update order", async () => {
      // Seed an active pending order
      const activeOrder: Order = {
        id: "ord-valid-discount-target",
        orderNumber: "8881",
        date: new Date().toISOString(),
        type: "Dine-In",
        items: [],
        subtotal: 200,
        tax: 10,
        total: 210,
        status: "Pending",
        cashierId: "staff-cashier",
        cashierName: "Cashier Amit"
      };
      await orderRepo.save(TENANT_ID, activeOrder);

      const res = await fetch(`${serverUrl}/api/orders/audit-discount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cashierToken}`,
          "x-session-id": cashierToken,
          "x-tenant-id": TENANT_ID
        },
        body: JSON.stringify({
          orderId: "ord-valid-discount-target",
          originalAmount: 210,
          discountAmount: 40,
          finalAmount: 170,
          managerPin: MANAGER_PIN,
          reason: "Manager Goodwill"
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.authorizer).toBe("Manager Priya");
      expect(data.discountAmount).toBe(40);
      expect(data.finalAmount).toBe(170);

      // Verify the order in the database was updated
      const updatedOrder = await orderRepo.get(TENANT_ID, "ord-valid-discount-target");
      expect(updatedOrder).toBeDefined();
      expect(updatedOrder?.discount).toBe(40);
      expect(updatedOrder?.total).toBe(170);

      // Verify audit log entry was written
      const logs = await auditLogService.getLogs(TENANT_ID);
      const discountAudit = logs.find((l) => (l.eventType === "DISCOUNT_APPLIED" || (l as any).action === "DISCOUNT_APPLIED") && (l.details as any)?.orderId === "ord-valid-discount-target");
      expect(discountAudit).toBeDefined();
      expect(discountAudit?.actor || (discountAudit as any)?.performedBy).toBe("Manager Priya");
      expect((discountAudit?.details as any)?.discountAmount).toBe(40);
    });
  });
});
