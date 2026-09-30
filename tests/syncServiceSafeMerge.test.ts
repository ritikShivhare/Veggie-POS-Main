import { describe, it, expect, beforeEach } from "vitest";
import { SyncService } from "../server/features/shared/SyncService";
import { MenuRepository } from "../server/features/pos/MenuRepository";
import { IngredientRepository } from "../server/features/inventory/IngredientRepository";
import { RecipeRepository } from "../server/features/inventory/RecipeRepository";
import { StaffRepository } from "../server/features/staff/StaffRepository";
import { OrderRepository } from "../server/features/pos/OrderRepository";
import { CustomerRepository } from "../server/features/crm/CustomerRepository";
import { PurchaseRepository } from "../server/features/inventory/PurchaseRepository";
import { ShiftRepository } from "../server/features/staff/ShiftRepository";
import { SettingsRepository } from "../server/features/shared/SettingsRepository";

describe("SyncService Safe Merging & Timestamp Conflict Resolution Tests", () => {
  let syncService: SyncService;
  const tenantId = "test-tenant-safe-sync";

  beforeEach(() => {
    syncService = new SyncService(
      new MenuRepository(),
      new IngredientRepository(),
      new RecipeRepository(),
      new StaffRepository(),
      new OrderRepository(),
      new CustomerRepository(),
      new PurchaseRepository(),
      new ShiftRepository(),
      new SettingsRepository()
    );
  });

  it("should NEVER drop existing database records just because an offline client omitted them", async () => {
    // 1. Initial server state has Order 1 and Order 2
    await syncService.saveFullState(tenantId, {
      orders: [
        { id: "ord-1", orderNumber: "#01", total: 100, status: "Completed", updatedAt: "2026-09-30T10:00:00.000Z" },
        { id: "ord-2", orderNumber: "#02", total: 200, status: "Completed", updatedAt: "2026-09-30T10:05:00.000Z" }
      ]
    });

    // 2. Offline client was disconnected and only has a partial payload with a newly created offline order (ord-3)
    // and omits ord-1 and ord-2 completely
    const result = await syncService.saveFullState(tenantId, {
      orders: [
        { id: "ord-3", orderNumber: "#03", total: 300, status: "Pending", updatedAt: "2026-09-30T10:15:00.000Z" }
      ]
    });

    // Both previous server records (ord-1, ord-2) and the new record (ord-3) must exist
    const orderIds = result.orders.map((o: any) => o.id).sort();
    expect(orderIds).toEqual(["ord-1", "ord-2", "ord-3"]);
    expect(result.orders).toHaveLength(3);
  });

  it("should NOT overwrite a server record if the client version has an older updatedAt timestamp", async () => {
    // 1. Server has an order updated at 10:30 by Device 2
    await syncService.saveFullState(tenantId, {
      orders: [
        {
          id: "ord-concurrent",
          orderNumber: "#99",
          total: 100,
          status: "Paid",
          updatedAt: "2026-09-30T10:30:00.000Z"
        }
      ]
    });

    // 2. Device 1 syncs later, but its local copy is stale from 10:10 (status was "Pending")
    const result = await syncService.saveFullState(tenantId, {
      orders: [
        {
          id: "ord-concurrent",
          orderNumber: "#99",
          total: 100,
          status: "Pending",
          updatedAt: "2026-09-30T10:10:00.000Z"
        }
      ]
    });

    // The newer server status ("Paid" from 10:30) must be preserved! Stale "Pending" is discarded.
    const ord = result.orders.find((o: any) => o.id === "ord-concurrent");
    expect(ord.status).toBe("Paid");
    expect(ord.updated_at || ord.updatedAt).toBe("2026-09-30T10:30:00.000Z");
  });

  it("SHOULD update the server record if the client version has a strictly newer updatedAt timestamp", async () => {
    // 1. Server has an order updated at 11:00
    await syncService.saveFullState(tenantId, {
      orders: [
        {
          id: "ord-newer",
          orderNumber: "#100",
          total: 100,
          status: "Preparing",
          updatedAt: "2026-09-30T11:00:00.000Z"
        }
      ]
    });

    // 2. Client updated the order offline at 11:15 (status "Completed")
    const result = await syncService.saveFullState(tenantId, {
      orders: [
        {
          id: "ord-newer",
          orderNumber: "#100",
          total: 100,
          status: "Completed",
          updatedAt: "2026-09-30T11:15:00.000Z"
        }
      ]
    });

    // Client's newer update is accepted
    const ord = result.orders.find((o: any) => o.id === "ord-newer");
    expect(ord.status).toBe("Completed");
    expect(ord.updated_at || ord.updatedAt).toBe("2026-09-30T11:15:00.000Z");
  });

  it("should RECALCULATE and enforce authoritative pricing when an offline client updates an existing order with a fake low total", async () => {
    // 1. Create menu item in tenant: Paneer Pizza @ ₹250
    await syncService.saveFullState(tenantId, {
      menuItems: [
        { id: "menu-pizza", name: "Paneer Pizza", price: 250, category: "Pizza", isAvailable: true }
      ]
    });

    // 2. Initial order created with 2 Pizzas (Authoritative total = ₹500)
    await syncService.saveFullState(tenantId, {
      orders: [
        {
          id: "ord-tamper-check",
          orderNumber: "#201",
          items: [{ menuItemId: "menu-pizza", quantity: 2 }],
          updatedAt: "2026-09-30T12:00:00.000Z"
        }
      ]
    });

    const initial = await syncService.getFullState(tenantId);
    const ordBefore = initial.orders.find((o: any) => o.id === "ord-tamper-check");
    expect(ordBefore.total).toBe(500);

    // 3. Offline client attempts to UPDATE this existing order, tampering total to a fake low amount ₹1.00
    const result = await syncService.saveFullState(tenantId, {
      orders: [
        {
          id: "ord-tamper-check",
          orderNumber: "#201",
          items: [{ menuItemId: "menu-pizza", quantity: 2 }],
          total: 1.00, // Fake manipulated low total!
          subtotal: 1.00,
          tax: 0,
          discount: 0,
          updatedAt: "2026-09-30T12:30:00.000Z"
        }
      ]
    });

    // 4. Server MUST NOT accept the fake ₹1.00 total! It must recalculate and enforce the correct math (₹500.00)
    const ordAfter = result.orders.find((o: any) => o.id === "ord-tamper-check");
    expect(ordAfter.total).toBe(500);
    expect(ordAfter.subtotal).toBe(500);
  });

  it("should RECALCULATE authoritative pricing when existing order items are updated offline", async () => {
    // 1. Order initially had 1 Pizza (₹250)
    await syncService.saveFullState(tenantId, {
      menuItems: [
        { id: "menu-pizza", name: "Paneer Pizza", price: 250, category: "Pizza", isAvailable: true }
      ],
      orders: [
        {
          id: "ord-items-update",
          orderNumber: "#202",
          items: [{ menuItemId: "menu-pizza", quantity: 1 }],
          updatedAt: "2026-09-30T13:00:00.000Z"
        }
      ]
    });

    // 2. Client offline updates quantity from 1 to 3, but sends a fake low total of ₹5.00
    const result = await syncService.saveFullState(tenantId, {
      orders: [
        {
          id: "ord-items-update",
          orderNumber: "#202",
          items: [{ menuItemId: "menu-pizza", quantity: 3 }],
          total: 5.00, // Client tries to dictate arbitrary total
          updatedAt: "2026-09-30T13:10:00.000Z"
        }
      ]
    });

    // Server enforces correct 3 * 250 = 750 math
    const ord = result.orders.find((o: any) => o.id === "ord-items-update");
    expect(ord.total).toBe(750);
    expect(ord.subtotal).toBe(750);
  });
});
