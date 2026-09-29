import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import http from "http";
import { app } from "../server";
import { Database } from "../server/features/shared/database";
import { posPricingEngine, FinancialValidationError } from "../server/features/pos/POSPricingEngine";
import { FinancialTransactionService } from "../server/features/pos/FinancialTransactionService";
import { MenuRepository } from "../server/features/pos/MenuRepository";
import { SettingsRepository } from "../server/features/shared/SettingsRepository";
import {
  staffRepo,
  orderRepo,
  ingredientRepo,
  recipeRepo,
  customerRepo,
  auditLogService,
  getGlobalTenantsList,
  saveGlobalTenantsList,
  realtimeService
} from "../server/context";
import { hashPin } from "../server/features/auth/PinSecurityService";
import { MenuItem, Ingredient, Recipe, Customer } from "../src/features/shared/types";

describe("Phase 3: Financial Data Integrity & Database Transactions", () => {
  const TENANT_A = "tenant-fin-a";
  const TENANT_B = "tenant-fin-b";
  const OWNER_PIN = "1111";

  let server: http.Server;
  let serverUrl: string;
  let ownerToken: string = "";

  let db: Database;
  let menuRepo: MenuRepository;
  let settingsRepo: SettingsRepository;
  let financialService: FinancialTransactionService;

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
        name: "Financial Test Bistro",
        tenantId: TENANT_A,
        status: "active",
        created: "2026-09-28",
        region: "North India",
        ownerName: "Owner Fin",
        email: "owner@fin.com"
      });
      await saveGlobalTenantsList(globalTenants);
    }
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
    financialService = FinancialTransactionService.getInstance();

    // Seed Settings for Tenant A (enable auto stock deduction and standard GST)
    await settingsRepo.save(TENANT_A, {
      autoDeductStock: true,
      blockOrdersIfInsufficient: true,
      managerCanAddPurchases: true,
      managerCanEditRecipes: true,
      kdsSoundAlerts: false,
      quickPinRequired: false,
      gstPercentage: 5
    } as any);

    // Seed Staff
    await staffRepo.saveAll(TENANT_A, [
      {
        id: "usr-owner-fin",
        name: "Vikram Owner",
        role: "Owner" as any,
        pin: await hashPin(OWNER_PIN),
        permissions: ["billing", "inventory", "reports", "settings", "staff", "orders"]
      }
    ]);

    // Authenticate owner to get session token
    const loginRes = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT_A, pin: OWNER_PIN })
    });
    const loginData = await loginRes.json();
    ownerToken = loginData.session.sessionId;

    // Seed Menu for Tenant A
    const tenantAMenu: MenuItem[] = [
      {
        id: "menu-pizza",
        name: "Farmhouse Pizza",
        price: 350,
        category: "Main Course",
        imageUrl: "🍕",
        isVegetarian: true,
        isAvailable: true,
        tenantId: TENANT_A
      } as any,
      {
        id: "menu-expensive-thali",
        name: "Royal Maharaja Thali",
        price: 500,
        category: "Main Course",
        imageUrl: "🍱",
        isVegetarian: true,
        isAvailable: true,
        tenantId: TENANT_A
      } as any,
      {
        id: "menu-burger",
        name: "Veggie Burger",
        price: 150,
        category: "Snacks",
        imageUrl: "🍔",
        isVegetarian: true,
        isAvailable: true,
        tenantId: TENANT_A
      } as any,
      {
        id: "menu-sold-out",
        name: "Special Dessert",
        price: 200,
        category: "Dessert",
        imageUrl: "🍰",
        isVegetarian: true,
        isAvailable: false,
        tenantId: TENANT_A
      } as any
    ];
    await menuRepo.saveAll(TENANT_A, tenantAMenu);

    // Seed Menu for Tenant B (alien tenant)
    const tenantBMenu: MenuItem[] = [
      {
        id: "menu-alien-shake",
        name: "Alien Milkshake",
        price: 999,
        category: "Beverages",
        imageUrl: "🥤",
        isVegetarian: true,
        isAvailable: true,
        tenantId: TENANT_B
      } as any
    ];
    await menuRepo.saveAll(TENANT_B, tenantBMenu);

    // Seed Ingredients and Recipe for Tenant A
    const ingredients: Ingredient[] = [
      {
        id: "ing-cheese",
        name: "Mozzarella Cheese",
        unit: "kg",
        currentStock: 10,
        minStock: 2,
        costPerUnit: 400
      },
      {
        id: "ing-flour",
        name: "Pizza Flour",
        unit: "kg",
        currentStock: 20,
        minStock: 5,
        costPerUnit: 50
      }
    ];
    await ingredientRepo.saveAll(TENANT_A, ingredients);

    const recipes: Recipe[] = [
      {
        menuItemId: "menu-pizza",
        ingredients: [
          { ingredientId: "ing-cheese", quantity: 0.2 },
          { ingredientId: "ing-flour", quantity: 0.3 }
        ]
      }
    ];
    await recipeRepo.saveAll(TENANT_A, recipes);

    // Seed Customer with Loyalty Points for Tenant A
    const customers: Customer[] = [
      {
        id: "cust-vip",
        name: "Rohan Loyal",
        phone: "9876543210",
        loyaltyPoints: 100,
        totalSpend: 5000,
        comingSince: "2025-01-01",
        lastVisited: "2026-09-20",
        totalVisits: 10,
        maxBillAmount: 1000,
        minBillAmount: 200,
        created_at: new Date().toISOString()
      }
    ];
    await customerRepo.saveAll(TENANT_A, customers);
  });

  // ==========================================================================
  // SECTION 4: SERVER-AUTHORITATIVE ORDER TOTALS & ATTACK SURFACE TESTS
  // ==========================================================================

  it("should reject order when client attempts price undercutting (menu ₹500 vs client ₹1)", async () => {
    // Menu price = ₹500. Client sends price = 1, subtotal = 1, total = 1
    const attackPayload = {
      items: [
        {
          menuItemId: "menu-expensive-thali",
          quantity: 1,
          price: 1
        }
      ],
      subtotal: 1,
      total: 1
    };

    // Attempting via pricing engine must reject
    await expect(
      posPricingEngine.validateAndCalculateOrder(TENANT_A, attackPayload as any)
    ).rejects.toThrow();

    // Attempting via live HTTP endpoint must return 400
    const res = await fetch(`${serverUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        id: "ord-attack-1",
        ...attackPayload
      })
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("PRICE_TAMPERING_DETECTED");

    // Verify row was NOT written to database
    const orderInDb = await orderRepo.getById(TENANT_A, "ord-attack-1");
    expect(orderInDb).toBeNull();
  });

  it("should reject excessive quantities exceeding maximum limit (> 1000)", async () => {
    const excessiveQtyOrder = {
      items: [
        {
          menuItemId: "menu-pizza",
          quantity: 1500
        }
      ]
    };

    await expect(
      posPricingEngine.validateAndCalculateOrder(TENANT_A, excessiveQtyOrder as any)
    ).rejects.toThrow("exceeds maximum limit of 1000");
  });

  it("should reject manipulated GST / tax amount", async () => {
    // Subtotal: 350. GST rate: 5% = 17.5. Total: 367.5.
    // Client claims total = 350 (fraudulent tax avoidance)
    const manipulatedTaxOrder = {
      items: [{ menuItemId: "menu-pizza", quantity: 1, price: 350 }],
      total: 350 // missing ₹17.5 GST
    };

    await expect(
      posPricingEngine.validateAndCalculateOrder(TENANT_A, manipulatedTaxOrder as any)
    ).rejects.toThrow("does not match authoritative calculated total");
  });

  it("should calculate server-authoritative totals accurately including tax", async () => {
    const legitimateOrder = {
      items: [
        {
          menuItemId: "menu-pizza", // 350 * 2 = 700
          quantity: 2
        }
      ]
    };

    // Subtotal: 700. Tax: 5% of 700 = 35. Total: 735.
    const calc = await posPricingEngine.validateAndCalculateOrder(TENANT_A, legitimateOrder as any);
    expect(calc.subtotal).toBe(700);
    expect(calc.tax).toBe(35);
    expect(calc.total).toBe(735);
  });

  it("should reject orders containing menu items belonging to another tenant (403)", async () => {
    const crossTenantOrder = {
      items: [
        {
          menuItemId: "menu-alien-shake",
          tenantId: TENANT_B,
          quantity: 1
        }
      ]
    };

    await expect(
      posPricingEngine.validateAndCalculateOrder(TENANT_A, crossTenantOrder as any)
    ).rejects.toThrow();
  });

  it("should reject orders with invalid or non-existent menu items (404)", async () => {
    const invalidOrder = {
      items: [{ menuItemId: "menu-ghost-item", quantity: 1 }]
    };

    await expect(
      posPricingEngine.validateAndCalculateOrder(TENANT_A, invalidOrder as any)
    ).rejects.toThrow(FinancialValidationError);
  });

  it("should reject negative or zero item quantities (400)", async () => {
    await expect(
      posPricingEngine.validateAndCalculateOrder(TENANT_A, {
        items: [{ menuItemId: "menu-pizza", quantity: -2 }]
      } as any)
    ).rejects.toThrow(FinancialValidationError);

    await expect(
      posPricingEngine.validateAndCalculateOrder(TENANT_A, {
        items: [{ menuItemId: "menu-pizza", quantity: 0 }]
      } as any)
    ).rejects.toThrow(FinancialValidationError);
  });

  it("should reject negative item prices (400)", async () => {
    await expect(
      posPricingEngine.validateAndCalculateOrder(TENANT_A, {
        items: [{ menuItemId: "menu-pizza", quantity: 1, price: -100 }]
      } as any)
    ).rejects.toThrow(FinancialValidationError);
  });

  it("should reject unauthorized manual discounts from unauthorized roles", async () => {
    await expect(
      posPricingEngine.validateAndCalculateOrder(
        TENANT_A,
        {
          items: [{ menuItemId: "menu-pizza", quantity: 1 }],
          appliedDiscount: 100
        } as any,
        { role: "Cashier", permissions: ["billing"] }
      )
    ).rejects.toThrow(FinancialValidationError);
  });

  it("should reject payment if amount does not match authoritative order total", async () => {
    // 1. Create a pending order with total 367.5 (350 + 5% GST)
    const created = await financialService.executeOrderPlacement(TENANT_A, {
      id: "ord-pending-payment",
      status: "Pending",
      items: [{ menuItemId: "menu-pizza", quantity: 1 }]
    } as any);

    expect(created.order.total).toBe(367.5);

    // 2. Client attempts to pay ₹50
    await expect(
      financialService.executeOrderPayment(TENANT_A, "ord-pending-payment", {
        amount: 50,
        paymentMethod: "Cash"
      })
    ).rejects.toThrow("does not match authoritative order total");

    // Order must remain Pending
    const order = await orderRepo.getById(TENANT_A, "ord-pending-payment");
    expect(order?.status).toBe("Pending");
  });

  // ==========================================================================
  // SECTION 3: FAILURE-INJECTION TESTS (TRANSACTION ROLLBACK INTEGRITY)
  // ==========================================================================

  it("deliberately fail during order placement transaction -> verify NO order, NO payment, NO inventory movement, NO loyalty mutation, NO audit record", async () => {
    const initialCheese = await ingredientRepo.getById(TENANT_A, "ing-cheese");
    const initialCust = await customerRepo.getById(TENANT_A, "cust-vip");
    const initialLogs = await auditLogService.getLogs(TENANT_A);
    const initialMovements = await financialService.getInventoryMovementRepo().getAll(TENANT_A);
    const initialPayments = await financialService.getPaymentRepo().getAll(TENANT_A);

    // Deliberately simulate failure during ingredient persistence in transaction
    const originalSaveAll = ingredientRepo.saveAll.bind(ingredientRepo);
    vi.spyOn(ingredientRepo, "saveAll").mockImplementation(async (tenantId, items, trx) => {
      if (trx) {
        throw new Error("Simulated storage failure on ingredientRepo during order placement!");
      }
      return originalSaveAll(tenantId, items, trx);
    });

    await expect(
      financialService.executeOrderPlacement(TENANT_A, {
        id: "ord-fail-injection-1",
        customerName: "Rohan Loyal",
        customerId: "cust-vip",
        items: [{ menuItemId: "menu-pizza", quantity: 2 }],
        paymentMethod: "UPI",
        status: "Completed"
      } as any)
    ).rejects.toThrow("Simulated storage failure");

    vi.restoreAllMocks();

    // 1. Verify NO order was persisted
    const order = await orderRepo.getById(TENANT_A, "ord-fail-injection-1");
    expect(order).toBeNull();

    // 2. Verify NO order items were persisted
    const orderItems = await financialService.getOrderItemRepo().getAll(TENANT_A);
    expect(orderItems.find((oi) => oi.orderId === "ord-fail-injection-1")).toBeUndefined();

    // 3. Verify NO payment was persisted
    const payments = await financialService.getPaymentRepo().getAll(TENANT_A);
    expect(payments.find((p) => p.orderId === "ord-fail-injection-1")).toBeUndefined();
    expect(payments.length).toBe(initialPayments.length);

    // 4. Verify NO inventory movements were persisted
    const movements = await financialService.getInventoryMovementRepo().getAll(TENANT_A);
    expect(movements.find((m) => m.referenceId === "ord-fail-injection-1")).toBeUndefined();
    expect(movements.length).toBe(initialMovements.length);

    // 5. Verify NO ingredient stock was deducted
    const cheese = await ingredientRepo.getById(TENANT_A, "ing-cheese");
    expect(cheese?.currentStock).toBe(initialCheese?.currentStock);

    // 6. Verify NO customer loyalty mutation occurred
    const cust = await customerRepo.getById(TENANT_A, "cust-vip");
    expect(cust?.loyaltyPoints).toBe(initialCust?.loyaltyPoints);
    expect(cust?.totalSpend).toBe(initialCust?.totalSpend);

    // 7. Verify NO audit record claiming success was written
    const logs = await auditLogService.getLogs(TENANT_A);
    expect(logs.find((l) => l.details?.orderId === "ord-fail-injection-1")).toBeUndefined();
    expect(logs.length).toBe(initialLogs.length);
  });

  it("deliberately fail during order cancellation -> verify order and payment states do NOT partially commit", async () => {
    // 1. Place an order first
    const placed = await financialService.executeOrderPlacement(TENANT_A, {
      id: "ord-cancel-fail",
      paymentMethod: "Cash",
      status: "Completed",
      items: [{ menuItemId: "menu-pizza", quantity: 1 }]
    } as any);

    expect(placed.order.status).toBe("Completed");

    // 2. Deliberately simulate failure on ingredientRepo during cancellation restocking
    const originalSaveAll = ingredientRepo.saveAll.bind(ingredientRepo);
    vi.spyOn(ingredientRepo, "saveAll").mockImplementation(async (tenantId, items, trx) => {
      if (trx) {
        throw new Error("Simulated storage failure during cancellation restocking!");
      }
      return originalSaveAll(tenantId, items, trx);
    });

    await expect(
      financialService.executeOrderCancellation(TENANT_A, "ord-cancel-fail", {
        cancelledBy: "Manager Rohit",
        reason: "Customer changed mind"
      })
    ).rejects.toThrow("Simulated storage failure");

    vi.restoreAllMocks();

    // 3. Verify order status remains 'Completed' (not partially changed to Cancelled)
    const order = await orderRepo.getById(TENANT_A, "ord-cancel-fail");
    expect(order?.status).toBe("Completed");

    // 4. Verify payment status remains 'Completed' (not partially changed to Refunded)
    const payments = await financialService.getPaymentRepo().getAll(TENANT_A);
    const payment = payments.find((p) => p.orderId === "ord-cancel-fail");
    expect(payment?.status).toBe("Completed");

    // 5. Verify NO cancellation audit record was stored
    const logs = await auditLogService.getLogs(TENANT_A);
    expect(logs.find((l) => l.eventType === "ORDER_CANCELLED" && l.details?.orderId === "ord-cancel-fail")).toBeUndefined();
  });

  // ==========================================================================
  // SECTION 5: IDEMPOTENCY & CONCURRENT DUPLICATE MUTATION VERIFICATION
  // ==========================================================================

  it("should handle 5 simultaneous concurrent requests with the SAME Idempotency-Key: exactly 1 effect committed", async () => {
    const idempotencyKey = `idem-concurrent-${Date.now()}`;
    const orderId = `ord-idem-conc-${Date.now()}`;

    const payload = {
      id: orderId,
      customerName: "Aman",
      items: [{ menuItemId: "menu-pizza", quantity: 1 }],
      paymentMethod: "UPI",
      status: "Completed"
    };

    // Fire 5 simultaneous requests with the exact same Idempotency-Key
    const requests = Array.from({ length: 5 }, () =>
      fetch(`${serverUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ownerToken}`,
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(payload)
      })
    );

    const responses = await Promise.all(requests);

    // All 5 requests must return HTTP 200
    for (const res of responses) {
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.order.id).toBe(orderId);
    }

    // At least some responses should have 'Idempotent-Replayed: true'
    const replayHeaders = responses.map((r) => r.headers.get("Idempotent-Replayed"));
    expect(replayHeaders.some((h) => h === "true")).toBe(true);

    // CRITICAL: Verify DB state has EXACTLY ONE order row
    const orders = (await orderRepo.getAll(TENANT_A)).filter((o) => o.id === orderId);
    expect(orders).toHaveLength(1);

    // Verify DB state has EXACTLY ONE payment row for this order
    const payments = (await financialService.getPaymentRepo().getAll(TENANT_A)).filter(
      (p) => p.orderId === orderId
    );
    expect(payments).toHaveLength(1);

    // Verify inventory cheese was deducted EXACTLY ONCE (0.2kg, not 5 * 0.2 = 1.0kg)
    const cheese = await ingredientRepo.getById(TENANT_A, "ing-cheese");
    expect(cheese?.currentStock).toBe(9.8); // 10 - 0.2 = 9.8

    // Verify audit logs has EXACTLY ONE entry for this order
    const logs = (await auditLogService.getLogs(TENANT_A)).filter(
      (l) => l.details?.orderId === orderId
    );
    expect(logs).toHaveLength(1);
  });

  it("should return the cached original response when same key is sent with different payload", async () => {
    const idempotencyKey = `idem-divergent-${Date.now()}`;

    // Request 1: Original Order
    const res1 = await fetch(`${serverUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerToken}`,
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        id: "ord-divergent-1",
        customerName: "Original Order",
        items: [{ menuItemId: "menu-burger", quantity: 1 }]
      })
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.order.id).toBe("ord-divergent-1");

    // Request 2: Different payload with same key
    const res2 = await fetch(`${serverUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerToken}`,
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        id: "ord-divergent-2",
        customerName: "Different Order",
        items: [{ menuItemId: "menu-pizza", quantity: 2 }]
      })
    });

    // Phase 4 Step 2: Same key + different request payload = deterministic rejection (422)
    expect(res2.status).toBe(422);
    const data2 = await res2.json();
    expect(data2.error).toBe("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");

    // Verify ord-divergent-2 was NEVER created in the database
    const ghostOrder = await orderRepo.getById(TENANT_A, "ord-divergent-2");
    expect(ghostOrder).toBeNull();
  });

  // ==========================================================================
  // SECTION 6: OFFLINE OUTBOX FORGED MUTATION TESTS
  // ==========================================================================

  it("should reject forged offline outbox mutations with tampered item price and total", async () => {
    // Menu item 'menu-expensive-thali' is ₹500
    // Offline outbox payload attempts price = ₹1, total = ₹1
    const forgedOfflinePayload = {
      operationId: `op-forged-${Date.now()}`,
      entityType: "order",
      entityId: "ord-forged-offline-1",
      operationType: "CREATE",
      payload: {
        id: "ord-forged-offline-1",
        customerName: "Offline Attacker",
        items: [
          {
            menuItemId: "menu-expensive-thali",
            quantity: 1,
            price: 1
          }
        ],
        subtotal: 1,
        total: 1,
        status: "Completed",
        paymentMethod: "Cash"
      }
    };

    const outboxRes = await fetch(`${serverUrl}/api/sync/outbox`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ownerToken}`
      },
      body: JSON.stringify(forgedOfflinePayload)
    });

    expect(outboxRes.status).toBe(400);
    const resData = await outboxRes.json();
    expect(resData.success).toBe(false);
    expect(resData.error).toBe("PRICE_TAMPERING_DETECTED");

    // Verify forged order was NOT written to database
    const forgedInDb = await orderRepo.getById(TENANT_A, "ord-forged-offline-1");
    expect(forgedInDb).toBeNull();
  });
});
