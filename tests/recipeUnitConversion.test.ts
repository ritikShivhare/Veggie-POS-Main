import { describe, it, expect, beforeEach } from "vitest";
import {
  getUnitConversionRatio,
  convertRecipeQuantityToIngredientStock,
  calculatePortionCost,
  getDefaultRecipeUnit,
  getCompatibleUnits,
  normalizeUnit
} from "../src/features/shared/utils/unitConversion";
import { posPricingEngine, FinancialValidationError } from "../server/features/pos/POSPricingEngine";
import { FinancialTransactionService } from "../server/features/pos/FinancialTransactionService";
import { Database } from "../server/features/shared/database";
import { MenuRepository } from "../server/features/pos/MenuRepository";
import { SettingsRepository } from "../server/features/shared/SettingsRepository";
import { IngredientRepository } from "../server/features/inventory/IngredientRepository";
import { RecipeRepository } from "../server/features/inventory/RecipeRepository";
import { OrderRepository } from "../server/features/pos/OrderRepository";
import { MenuItem, Ingredient, Recipe, Order } from "../src/features/shared/types";

describe("Recipe Unit vs Raw Material Unit (Grams vs Kilograms) Mismatch Resolution", () => {
  describe("Unit Conversion Engine & Aliases", () => {
    it("should accurately convert grams to kilograms (1/1000 ratio)", () => {
      expect(getUnitConversionRatio("g", "kg")).toBeCloseTo(0.001);
      expect(convertRecipeQuantityToIngredientStock(200, "g", "kg")).toBe(0.2);
      expect(convertRecipeQuantityToIngredientStock(50, "g", "kg")).toBe(0.05);
      expect(convertRecipeQuantityToIngredientStock(1500, "g", "kg")).toBe(1.5);
    });

    it("should accurately convert kilograms to grams (1000x ratio)", () => {
      expect(getUnitConversionRatio("kg", "g")).toBe(1000);
      expect(convertRecipeQuantityToIngredientStock(0.25, "kg", "g")).toBe(250);
      expect(convertRecipeQuantityToIngredientStock(2, "kg", "g")).toBe(2000);
    });

    it("should accurately convert milliliters to liters (1/1000 ratio)", () => {
      expect(getUnitConversionRatio("ml", "l")).toBeCloseTo(0.001);
      expect(convertRecipeQuantityToIngredientStock(250, "ml", "l")).toBe(0.25);
      expect(convertRecipeQuantityToIngredientStock(15, "ml", "l")).toBe(0.015);
    });

    it("should accurately convert liters to milliliters (1000x ratio)", () => {
      expect(getUnitConversionRatio("l", "ml")).toBe(1000);
      expect(convertRecipeQuantityToIngredientStock(1.5, "l", "ml")).toBe(1500);
    });

    it("should handle unit string aliases and case insensitivity seamlessly", () => {
      expect(convertRecipeQuantityToIngredientStock(200, "Grams", "KG")).toBe(0.2);
      expect(convertRecipeQuantityToIngredientStock(200, "gm", "kgs")).toBe(0.2);
      expect(convertRecipeQuantityToIngredientStock(500, "ml", "Litre")).toBe(0.5);
      expect(convertRecipeQuantityToIngredientStock(1, "pcs", "pieces")).toBe(1);
    });

    it("should default to 1:1 ratio if recipe unit is omitted (backward compatibility)", () => {
      expect(convertRecipeQuantityToIngredientStock(0.2, undefined, "kg")).toBe(0.2);
      expect(convertRecipeQuantityToIngredientStock(150, undefined, "g")).toBe(150);
      expect(convertRecipeQuantityToIngredientStock(2, "", "pcs")).toBe(2);
    });

    it("should fallback gracefully to 1:1 for unconvertible mixed unit categories", () => {
      expect(convertRecipeQuantityToIngredientStock(5, "pcs", "kg")).toBe(5);
    });

    it("should compute accurate portion costs based on converted weights and WAC rates", () => {
      // 200g of paneer bought at ₹400/kg -> 0.2 * 400 = ₹80.00
      const paneerCost = calculatePortionCost(200, "g", { unit: "kg", costPerUnit: 400 });
      expect(paneerCost).toBe(80);

      // 25ml of cooking oil bought at ₹160/L -> 0.025 * 160 = ₹4.00
      const oilCost = calculatePortionCost(25, "ml", { unit: "l", costPerUnit: 160 });
      expect(oilCost).toBe(4);

      // 1 burger bun bought at ₹6/pcs -> 1 * 6 = ₹6.00
      const bunCost = calculatePortionCost(1, "pcs", { unit: "pcs", costPerUnit: 6 });
      expect(bunCost).toBe(6);
    });

    it("should suggest appropriate default units and compatible options", () => {
      expect(getDefaultRecipeUnit("kg")).toBe("g");
      expect(getDefaultRecipeUnit("l")).toBe("ml");
      expect(getDefaultRecipeUnit("pcs")).toBe("pcs");

      const weightUnits = getCompatibleUnits("kg").map(u => u.value);
      expect(weightUnits).toContain("g");
      expect(weightUnits).toContain("kg");

      const volumeUnits = getCompatibleUnits("l").map(u => u.value);
      expect(volumeUnits).toContain("ml");
      expect(volumeUnits).toContain("l");
    });
  });

  describe("Server-Authoritative POS Stock Deductions with Unit Mismatch", () => {
    const tenantId = "test-tenant-unit-conversion";
    let db: Database;
    let menuRepo: MenuRepository;
    let settingsRepo: SettingsRepository;
    let ingredientRepo: IngredientRepository;
    let recipeRepo: RecipeRepository;
    let orderRepo: OrderRepository;
    let finService: FinancialTransactionService;

    beforeEach(async () => {
      db = Database.getInstance();
      (db as any).tablesByTenant[tenantId] = {};
      (db as any).objectsByTenant[tenantId] = {};

      menuRepo = new MenuRepository();
      settingsRepo = new SettingsRepository();
      ingredientRepo = new IngredientRepository();
      recipeRepo = new RecipeRepository();
      orderRepo = new OrderRepository();
      finService = FinancialTransactionService.getInstance();

      // Configure inventory settings
      await settingsRepo.save(tenantId, {
        autoDeductStock: true,
        blockOrdersIfInsufficient: true,
        gstPercentage: 5
      } as any);

      // Menu Item: Paneer Tikka (₹280)
      const menuItems: MenuItem[] = [
        {
          id: "dish-paneer-tikka",
          name: "Paneer Tikka",
          price: 280,
          category: "Starters",
          imageUrl: "🍢",
          isVegetarian: true,
          isAvailable: true,
          tenantId
        } as any
      ];
      await menuRepo.saveAll(tenantId, menuItems);

      // Ingredients in Bulk Units (Kilograms):
      // Paneer: 5 kg in stock
      // Capsicum: 2 kg in stock
      const rawMaterials: Ingredient[] = [
        {
          id: "ing-bulk-paneer",
          name: "Fresh Paneer",
          unit: "kg",
          currentStock: 5.0, // 5 kg
          minStock: 1.0,
          costPerUnit: 400
        },
        {
          id: "ing-bulk-capsicum",
          name: "Green Capsicum",
          unit: "kg",
          currentStock: 2.0, // 2 kg
          minStock: 0.5,
          costPerUnit: 80
        }
      ];
      await ingredientRepo.saveAll(tenantId, rawMaterials);

      // Recipe BOM: Defined in GRAMS ('g')!
      // 1 Portion Paneer Tikka uses:
      // - 250 g Paneer (0.25 kg)
      // - 50 g Capsicum (0.05 kg)
      const recipes: Recipe[] = [
        {
          menuItemId: "dish-paneer-tikka",
          ingredients: [
            { ingredientId: "ing-bulk-paneer", quantity: 250, unit: "g" },
            { ingredientId: "ing-bulk-capsicum", quantity: 50, unit: "g" }
          ]
        }
      ];
      await recipeRepo.saveAll(tenantId, recipes);
    });

    it("should deduct converted quantities (0.5kg for 2 orders of 250g) from bulk kg stock", async () => {
      // Order: 2 portions of Paneer Tikka
      // Expected deductions:
      // Paneer: 2 * 250g = 500g = 0.5kg -> New Stock: 5.0 - 0.5 = 4.5kg
      // Capsicum: 2 * 50g = 100g = 0.1kg -> New Stock: 2.0 - 0.1 = 1.9kg
      const orderPayload = {
        items: [{ menuItemId: "dish-paneer-tikka", quantity: 2 }]
      };

      const calc = await posPricingEngine.validateAndCalculateOrder(tenantId, orderPayload as any);
      expect(calc.inventoryDeductions).toBeDefined();
      expect(calc.inventoryDeductions).toHaveLength(2);

      const paneerDeduction = calc.inventoryDeductions!.find(d => d.ingredientId === "ing-bulk-paneer");
      expect(paneerDeduction).toBeDefined();
      expect(paneerDeduction?.quantityDeducted).toBe(0.5); // 0.5 kg, NOT 500 kg!
      expect(paneerDeduction?.previousStock).toBe(5.0);
      expect(paneerDeduction?.newStock).toBe(4.5);

      const capsicumDeduction = calc.inventoryDeductions!.find(d => d.ingredientId === "ing-bulk-capsicum");
      expect(capsicumDeduction).toBeDefined();
      expect(capsicumDeduction?.quantityDeducted).toBe(0.1); // 0.1 kg, NOT 100 kg!
      expect(capsicumDeduction?.previousStock).toBe(2.0);
      expect(capsicumDeduction?.newStock).toBe(1.9);
    });

    it("should block order with INSUFFICIENT_STOCK when converted grams exceed available kilograms", async () => {
      // Reduce stock of Paneer to 0.4 kg (400g)
      const paneer = await ingredientRepo.getById(tenantId, "ing-bulk-paneer");
      paneer!.currentStock = 0.4;
      await ingredientRepo.update(tenantId, paneer!);

      // Attempting to order 2 portions of Paneer Tikka requires 500g (0.5kg), exceeding 0.4kg
      const orderPayload = {
        items: [{ menuItemId: "dish-paneer-tikka", quantity: 2 }]
      };

      await expect(
        posPricingEngine.validateAndCalculateOrder(tenantId, orderPayload as any)
      ).rejects.toThrow(FinancialValidationError);
    });

    it("should accurately restock converted quantities when an order is cancelled", async () => {
      // 1. Place order for 2 portions of Paneer Tikka
      const orderPlacement = await finService.executeOrderPlacement(tenantId, {
        id: "ord-test-restock",
        items: [{ menuItemId: "dish-paneer-tikka", quantity: 2 }],
        status: "Completed"
      } as any);

      // Verify stock was deducted to 4.5kg and 1.9kg
      const paneerAfterOrder = await ingredientRepo.getById(tenantId, "ing-bulk-paneer");
      expect(paneerAfterOrder?.currentStock).toBe(4.5);

      // 2. Cancel order
      await finService.executeOrderCancellation(tenantId, "ord-test-restock", {
        reason: "Customer changed mind",
        cancelledBy: "usr-manager"
      });

      // Verify stock was returned back by 0.5kg to 5.0kg
      const paneerAfterCancel = await ingredientRepo.getById(tenantId, "ing-bulk-paneer");
      expect(paneerAfterCancel?.currentStock).toBe(5.0);

      const capsicumAfterCancel = await ingredientRepo.getById(tenantId, "ing-bulk-capsicum");
      expect(capsicumAfterCancel?.currentStock).toBe(2.0);
    });
  });
});
