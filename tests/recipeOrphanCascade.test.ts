import { describe, it, expect, beforeEach } from "vitest";
import { IngredientRepository } from "../server/features/inventory/IngredientRepository";
import { RecipeRepository } from "../server/features/inventory/RecipeRepository";
import { Database } from "../server/features/shared/database";
import { Recipe, Ingredient } from "../src/features/shared/types";

describe("Raw Material Deletion & Recipe Orphan Cascade Protection", () => {
  let db: Database;
  let ingredientRepo: IngredientRepository;
  let recipeRepo: RecipeRepository;

  const testTenant = "test-tenant-orphan-protection";

  beforeEach(() => {
    db = Database.getInstance();
    (db as any).tablesByTenant[testTenant] = {};
    (db as any).objectsByTenant[testTenant] = {};

    ingredientRepo = new IngredientRepository();
    recipeRepo = new RecipeRepository();
  });

  it("should cascade unlink a deleted ingredient across all recipes", async () => {
    // 1. Seed ingredients
    const ingredients: Ingredient[] = [
      { id: "ing-paneer", name: "Paneer", unit: "g", currentStock: 2000, minStock: 500, costPerUnit: 0.35 },
      { id: "ing-onion", name: "Onion", unit: "g", currentStock: 5000, minStock: 1000, costPerUnit: 0.05 },
      { id: "ing-tomato", name: "Tomato", unit: "g", currentStock: 4000, minStock: 1000, costPerUnit: 0.08 }
    ];
    await ingredientRepo.saveAll(testTenant, ingredients);

    // 2. Seed recipes linked to these ingredients
    const recipes: Recipe[] = [
      {
        menuItemId: "dish-paneer-butter",
        ingredients: [
          { ingredientId: "ing-paneer", quantity: 180 },
          { ingredientId: "ing-onion", quantity: 50 },
          { ingredientId: "ing-tomato", quantity: 80 }
        ],
        version: 1
      },
      {
        menuItemId: "dish-onion-kulcha",
        ingredients: [
          { ingredientId: "ing-onion", quantity: 70 }
        ],
        version: 1
      },
      {
        menuItemId: "dish-plain-rice",
        ingredients: [],
        version: 1
      }
    ];
    await recipeRepo.saveAll(testTenant, recipes);

    // 3. Unlink ing-onion (simulating raw material deletion cascade)
    const modifiedCount = await recipeRepo.unlinkIngredient(testTenant, "ing-onion");
    expect(modifiedCount).toBe(2);

    // 4. Delete the ingredient record
    await ingredientRepo.delete(testTenant, "ing-onion");

    // 5. Verify recipes state
    const updatedRecipes = (await recipeRepo.getAll(testTenant)) || [];
    const paneerDishRecipe = updatedRecipes.find(r => r.menuItemId === "dish-paneer-butter");
    expect(paneerDishRecipe).toBeDefined();
    expect(paneerDishRecipe?.ingredients).toHaveLength(2);
    expect(paneerDishRecipe?.ingredients.some(i => i.ingredientId === "ing-onion")).toBe(false);
    expect(paneerDishRecipe?.ingredients.some(i => i.ingredientId === "ing-paneer")).toBe(true);
    expect(paneerDishRecipe?.ingredients.some(i => i.ingredientId === "ing-tomato")).toBe(true);

    const kulchaRecipe = updatedRecipes.find(r => r.menuItemId === "dish-onion-kulcha");
    expect(kulchaRecipe).toBeDefined();
    expect(kulchaRecipe?.ingredients).toHaveLength(0); // Cleaned without orphan pointers

    // 6. Verify ingredient is deleted
    const remainingIngredients = (await ingredientRepo.getAll(testTenant)) || [];
    expect(remainingIngredients).toHaveLength(2);
    expect(remainingIngredients.some(i => i.id === "ing-onion")).toBe(false);
  });

  it("should self-heal existing orphan ingredients using cleanOrphanIngredients", async () => {
    // Seed existing recipes with some invalid/legacy ingredient IDs
    const recipes: Recipe[] = [
      {
        menuItemId: "dish-dal-tadka",
        ingredients: [
          { ingredientId: "ing-dal", quantity: 150 },
          { ingredientId: "ing-deleted-garlic", quantity: 20 },
          { ingredientId: "ing-deleted-ghee", quantity: 15 }
        ],
        version: 1
      }
    ];
    await recipeRepo.saveAll(testTenant, recipes);

    // Valid ingredients in the system
    const validIds = new Set(["ing-dal"]);

    const cleanResult = await recipeRepo.cleanOrphanIngredients(testTenant, validIds);
    expect(cleanResult.modifiedRecipesCount).toBe(1);
    expect(cleanResult.orphansRemovedCount).toBe(2);

    const healedRecipes = (await recipeRepo.getAll(testTenant)) || [];
    expect(healedRecipes[0].ingredients).toHaveLength(1);
    expect(healedRecipes[0].ingredients[0].ingredientId).toBe("ing-dal");
  });
});
