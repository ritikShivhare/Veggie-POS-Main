import { describe, it, expect, beforeEach } from "vitest";
import { Database, OptimisticLockConflictError, handleApiError } from "../server/features/shared/database";
import { BaseRepository } from "../server/features/shared/BaseRepository";
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

describe("Optimistic Locking and Versioning Concurrency Engine", () => {
  const tenantId = "test-tenant-opt-lock";

  let db: Database;
  let orderRepo: OrderRepository;
  let menuRepo: MenuRepository;
  let staffRepo: StaffRepository;
  let ingredientRepo: IngredientRepository;
  let recipeRepo: RecipeRepository;
  let customerRepo: CustomerRepository;
  let purchaseRepo: PurchaseRepository;
  let shiftRepo: ShiftRepository;
  let settingsRepo: SettingsRepository;
  let syncService: SyncService;

  beforeEach(async () => {
    db = Database.getInstance();
    orderRepo = new OrderRepository();
    menuRepo = new MenuRepository();
    staffRepo = new StaffRepository();
    ingredientRepo = new IngredientRepository();
    recipeRepo = new RecipeRepository();
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

    // Reset test slices
    await orderRepo.saveAll(tenantId, []);
    await menuRepo.saveAll(tenantId, []);
    await staffRepo.saveAll(tenantId, []);
  });

  describe("BaseRepository.update with Optimistic Locking", () => {
    it("should initialize new items with version 1 and updated_at", async () => {
      const order = {
        id: "ord-test-1",
        orderNumber: "#1001",
        total: 250,
        status: "Pending"
      };

      await orderRepo.add(tenantId, order as any);

      const saved = await orderRepo.getById(tenantId, "ord-test-1");
      expect(saved).toBeDefined();
      expect((saved as any).version).toBe(1);
      expect((saved as any).updated_at).toBeDefined();
    });

    it("should allow update when current version matches and increment version to 2", async () => {
      await orderRepo.add(tenantId, {
        id: "ord-test-2",
        orderNumber: "#1002",
        total: 500,
        status: "Pending",
        version: 1
      } as any);

      const updated = await orderRepo.update(tenantId, {
        id: "ord-test-2",
        orderNumber: "#1002",
        total: 500,
        status: "Preparing",
        version: 1
      } as any);

      expect((updated as any).version).toBe(2);
      expect((updated as any).status).toBe("Preparing");
      expect((updated as any).updated_at).toBeDefined();

      const fetched = await orderRepo.getById(tenantId, "ord-test-2");
      expect((fetched as any).version).toBe(2);
      expect((fetched as any).status).toBe("Preparing");
    });

    it("should reject stale update with 409 OptimisticLockConflictError when version is outdated", async () => {
      // Step 1: Create initial order at version 1
      await orderRepo.add(tenantId, {
        id: "ord-test-3",
        orderNumber: "#1003",
        total: 300,
        status: "Pending",
        version: 1
      } as any);

      // Step 2: Client A updates order to version 2
      await orderRepo.update(tenantId, {
        id: "ord-test-3",
        orderNumber: "#1003",
        total: 350,
        status: "Preparing",
        version: 1
      } as any);

      // Verify server order is now version 2
      const current = await orderRepo.getById(tenantId, "ord-test-3");
      expect((current as any).version).toBe(2);

      // Step 3: Client B (who has stale version 1) attempts to update the order
      await expect(
        orderRepo.update(tenantId, {
          id: "ord-test-3",
          orderNumber: "#1003",
          total: 400,
          status: "Completed",
          version: 1 // STALE VERSION!
        } as any)
      ).rejects.toThrow(OptimisticLockConflictError);

      try {
        await orderRepo.update(tenantId, {
          id: "ord-test-3",
          orderNumber: "#1003",
          total: 400,
          status: "Completed",
          version: 1
        } as any);
      } catch (err: any) {
        expect(err).toBeInstanceOf(OptimisticLockConflictError);
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("OPTIMISTIC_LOCK_CONFLICT");
        expect(err.expectedVersion).toBe(1);
        expect(err.currentVersion).toBe(2);
      }
    });

    it("should allow sequential updates and increment versions monotonically", async () => {
      await menuRepo.add(tenantId, {
        id: "menu-thali",
        name: "Special Thali",
        price: 200,
        category: "Main",
        isVegetarian: true,
        isAvailable: true
      } as any);

      // Update 1: version 1 -> 2
      const v2 = await menuRepo.update(tenantId, {
        id: "menu-thali",
        name: "Special Thali Deluxe",
        price: 220,
        category: "Main",
        isVegetarian: true,
        isAvailable: true,
        version: 1
      } as any);
      expect((v2 as any).version).toBe(2);

      // Update 2: version 2 -> 3
      const v3 = await menuRepo.update(tenantId, {
        id: "menu-thali",
        name: "Special Thali Deluxe Grand",
        price: 250,
        category: "Main",
        isVegetarian: true,
        isAvailable: true,
        version: 2
      } as any);
      expect((v3 as any).version).toBe(3);

      // Stale update with version 2 should fail now that it's at version 3
      await expect(
        menuRepo.update(tenantId, {
          id: "menu-thali",
          name: "Stale Thali",
          price: 180,
          category: "Main",
          isVegetarian: true,
          isAvailable: true,
          version: 2
        } as any)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "OPTIMISTIC_LOCK_CONFLICT"
      });
    });
  });

  describe("SyncService.saveFullState Conditional Updates", () => {
    it("should initialize tenant state slices with version 1", async () => {
      const payload = {
        menuItems: [
          { id: "m-1", name: "Paneer Tikka", price: 150, category: "Starters", isVegetarian: true, isAvailable: true }
        ],
        staffList: [
          { id: "s-1", name: "Rahul", role: "Owner", pin: "1234", permissions: ["billing"] }
        ],
        orders: [
          { id: "o-1", orderNumber: "#1", total: 150, status: "Completed" }
        ]
      };

      const result = await syncService.saveFullState(tenantId, payload);
      expect(result.menuItems[0].version).toBe(1);
      expect(result.staffList[0].version).toBe(1);
      expect(result.orders[0].version).toBe(1);
    });

    it("should increment version on modified slice items when incoming version matches", async () => {
      // Seed initial state
      await syncService.saveFullState(tenantId, {
        orders: [
          { id: "o-sync-1", orderNumber: "#10", total: 100, status: "Pending", version: 1 }
        ]
      });

      // Update status with correct matching version 1
      const updated = await syncService.saveFullState(tenantId, {
        orders: [
          { id: "o-sync-1", orderNumber: "#10", total: 100, status: "Ready", version: 1 }
        ]
      });

      expect(updated.orders[0].version).toBe(2);
      expect(updated.orders[0].status).toBe("Ready");
    });

    it("should reject full state sync with 409 when an item has stale version", async () => {
      // Step 1: Initial state (version 1)
      await syncService.saveFullState(tenantId, {
        orders: [
          { id: "o-conflict-1", orderNumber: "#20", total: 200, status: "Pending", version: 1 }
        ]
      });

      // Step 2: Update to version 2
      await syncService.saveFullState(tenantId, {
        orders: [
          { id: "o-conflict-1", orderNumber: "#20", total: 200, status: "Preparing", version: 1 }
        ]
      });

      // Step 3: Stale update attempting to save version 1 again
      await expect(
        syncService.saveFullState(tenantId, {
          orders: [
            { id: "o-conflict-1", orderNumber: "#20", total: 200, status: "Cancelled", version: 1 }
          ]
        })
      ).rejects.toThrow(OptimisticLockConflictError);
    });

    it("should not increment version on items that are unchanged", async () => {
      // Step 1: Initial state
      await syncService.saveFullState(tenantId, {
        staffList: [
          { id: "s-unchanged", name: "Chef Mohan", role: "Chef", pin: "5555", permissions: ["inventory"], version: 1 }
        ]
      });

      // Step 2: Save again with unchanged fields
      const state2 = await syncService.saveFullState(tenantId, {
        staffList: [
          { id: "s-unchanged", name: "Chef Mohan", role: "Chef", pin: "5555", permissions: ["inventory"], version: 1 }
        ]
      });

      // Version remains 1 since no changes were made
      expect(state2.staffList[0].version).toBe(1);
    });
  });

  describe("API Error Handler Response Formatting", () => {
    it("should correctly serialize OptimisticLockConflictError to HTTP 409", () => {
      let capturedStatus = 0;
      let capturedJson: any = null;

      const mockRes = {
        status: (s: number) => {
          capturedStatus = s;
          return mockRes;
        },
        json: (data: any) => {
          capturedJson = data;
          return mockRes;
        }
      };

      const conflictError = new OptimisticLockConflictError("Stale update rejected for item ord-123", {
        entityId: "ord-123",
        expectedVersion: 1,
        currentVersion: 3
      });

      handleApiError(mockRes, conflictError);

      expect(capturedStatus).toBe(409);
      expect(capturedJson.success).toBe(false);
      expect(capturedJson.error).toBe("OPTIMISTIC_LOCK_CONFLICT");
      expect(capturedJson.entityId).toBe("ord-123");
      expect(capturedJson.expectedVersion).toBe(1);
      expect(capturedJson.currentVersion).toBe(3);
    });
  });
});
