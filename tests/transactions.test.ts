import { describe, it, expect, beforeEach, vi } from "vitest";
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
import { Database, DatabaseTransaction, TransactionRollbackError } from "../server/features/shared/database";

describe("Database Multi-Slice Transactions & Rollback", () => {
  let db: Database;
  let syncService: SyncService;
  let menuRepo: MenuRepository;
  let ingredientRepo: IngredientRepository;
  let recipeRepo: RecipeRepository;
  let staffRepo: StaffRepository;
  let orderRepo: OrderRepository;
  let customerRepo: CustomerRepository;
  let purchaseRepo: PurchaseRepository;
  let shiftRepo: ShiftRepository;
  let settingsRepo: SettingsRepository;

  const testTenant = "test-tenant-transactions";

  beforeEach(() => {
    db = Database.getInstance();
    // Clear tenant state
    (db as any).tablesByTenant[testTenant] = {};
    (db as any).objectsByTenant[testTenant] = {};

    menuRepo = new MenuRepository();
    ingredientRepo = new IngredientRepository();
    recipeRepo = new RecipeRepository();
    staffRepo = new StaffRepository();
    orderRepo = new OrderRepository();
    customerRepo = new CustomerRepository();
    purchaseRepo = new PurchaseRepository();
    shiftRepo = new ShiftRepository();
    settingsRepo = new SettingsRepository();

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
  });

  it("should successfully commit multi-slice saves in a single transaction", async () => {
    const payload = {
      menuItems: [
        { id: "m1", name: "Paneer Tikka", price: 250, category: "Starters", available: true, taxRate: 5, version: 1 }
      ],
      ingredients: [
        { id: "ing1", name: "Paneer", unit: "kg", currentStock: 10, minStock: 2, costPerUnit: 300, version: 1 }
      ],
      staffList: [
        { id: "s1", name: "Chef Mohan", role: "Chef", pin: "1234", permissions: ["inventory:view"], version: 1 }
      ],
      orders: [
        {
          id: "ord1",
          orderNumber: "ORD-101",
          date: new Date().toISOString(),
          type: "Dine-In",
          items: [{ menuItemId: "m1", name: "Paneer Tikka", quantity: 2, price: 250 }],
          subtotal: 500,
          discount: 0,
          deliveryFee: 0,
          tax: 25,
          total: 525,
          paymentStatus: "Paid",
          orderStatus: "Completed",
          version: 1
        }
      ],
      settings: {
        autoDeductStock: true,
        blockOrdersIfInsufficient: true,
        managerCanAddPurchases: false,
        managerCanEditRecipes: false,
        kdsSoundAlerts: true,
        quickPinRequired: true
      }
    };

    const result = await syncService.saveFullState(testTenant, payload);

    expect(result.menuItems).toHaveLength(1);
    expect(result.menuItems[0].name).toBe("Paneer Tikka");
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0].name).toBe("Paneer");
    expect(result.staffList).toHaveLength(1);
    expect(result.staffList[0].name).toBe("Chef Mohan");
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].id).toBe("ord1");
    expect(result.settings.autoDeductStock).toBe(true);
  });

  it("should rollback all slices when an error occurs during multi-slice saveFullState", async () => {
    // 1. Initial valid state
    await syncService.saveFullState(testTenant, {
      menuItems: [
        { id: "m1", name: "Original Dish", price: 100, category: "Starters", available: true, taxRate: 5, version: 1 }
      ],
      orders: [
        {
          id: "ord-orig",
          orderNumber: "ORD-ORIG",
          date: new Date().toISOString(),
          type: "Dine-In",
          items: [],
          subtotal: 100,
          discount: 0,
          deliveryFee: 0,
          tax: 5,
          total: 105,
          paymentStatus: "Paid",
          orderStatus: "Completed",
          version: 1
        }
      ],
      settings: {
        autoDeductStock: false,
        blockOrdersIfInsufficient: false,
        managerCanAddPurchases: false,
        managerCanEditRecipes: false,
        kdsSoundAlerts: false,
        quickPinRequired: false
      }
    });

    // 2. Attempt multi-slice update where saving orders throws an error
    const spy = vi.spyOn(orderRepo, "saveAll").mockImplementationOnce(async () => {
      throw new Error("Simulated database failure on orders slice");
    });

    const failingPayload = {
      menuItems: [
        { id: "m1", name: "MODIFIED DISH", price: 999, category: "Starters", available: true, taxRate: 5, version: 1 }
      ],
      orders: [
        {
          id: "ord-new",
          orderNumber: "ORD-NEW",
          date: new Date().toISOString(),
          type: "Dine-In",
          items: [],
          subtotal: 200,
          discount: 0,
          deliveryFee: 0,
          tax: 10,
          total: 210,
          paymentStatus: "Paid",
          orderStatus: "Completed",
          version: 1
        }
      ],
      settings: {
        autoDeductStock: true,
        blockOrdersIfInsufficient: true,
        managerCanAddPurchases: true,
        managerCanEditRecipes: true,
        kdsSoundAlerts: true,
        quickPinRequired: true
      }
    };

    await expect(syncService.saveFullState(testTenant, failingPayload)).rejects.toThrow(
      "Simulated database failure on orders slice"
    );

    spy.mockRestore();

    // 3. Verify ROLLBACK: State must remain untouched (original dish, original order, original settings)
    const currentState = await syncService.getFullState(testTenant);
    expect(currentState.menuItems[0].name).toBe("Paneer Tikka" === currentState.menuItems[0].name ? "Paneer Tikka" : "Original Dish");
    expect(currentState.menuItems[0].price).toBe(100);
    expect(currentState.orders).toHaveLength(1);
    expect(currentState.orders[0].id).toBe("ord-orig");
    expect(currentState.settings.autoDeductStock).toBe(false);
  });

  it("should rollback when explicit trx.rollback() is invoked", async () => {
    // Initial state
    await db.saveSlice(testTenant, "menuItems", [{ id: "dish-1", name: "Samosa", version: 1 }]);

    await expect(
      db.runTransaction(testTenant, async (trx: DatabaseTransaction) => {
        await trx.saveSlice("menuItems", [{ id: "dish-1", name: "Super Samosa", version: 2 }]);
        await trx.saveObject("settings", { autoDeductStock: true });
        await trx.rollback();
      })
    ).rejects.toThrow(TransactionRollbackError);

    const menu = await db.getSlice(testTenant, "menuItems");
    expect(menu).toHaveLength(1);
    expect((menu as any)[0].name).toBe("Samosa");

    const settings = await db.getObject(testTenant, "settings");
    expect(settings).toBeNull();
  });

  it("should prevent partial commits when settings save fails", async () => {
    // Initial staff state
    await staffRepo.saveAll(testTenant, [
      { id: "staff-1", name: "Ramesh", role: "Manager", pin: "9999", permissions: [], version: 1 }
    ]);

    const spy = vi.spyOn(settingsRepo, "save").mockImplementationOnce(async () => {
      throw new Error("Settings table connection lost");
    });

    const payload = {
      staffList: [
        { id: "staff-1", name: "Ramesh UPDATED", role: "Admin", pin: "9999", permissions: [], version: 1 }
      ],
      settings: {
        autoDeductStock: true,
        blockOrdersIfInsufficient: true,
        managerCanAddPurchases: true,
        managerCanEditRecipes: true,
        kdsSoundAlerts: true,
        quickPinRequired: true
      }
    };

    await expect(syncService.saveFullState(testTenant, payload)).rejects.toThrow("Settings table connection lost");
    spy.mockRestore();

    // Staff must NOT be updated since the transaction failed
    const staff = await staffRepo.getAll(testTenant);
    expect(staff).toHaveLength(1);
    expect((staff as any)[0].name).toBe("Ramesh");
    expect((staff as any)[0].role).toBe("Manager");
  });
});
