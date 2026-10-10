import { Database, DatabaseTransaction, NotFoundError } from "../shared/database";
import { Recipe } from "../../../src/features/shared/types";

export class RecipeRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async getAll(tenantId: string): Promise<Recipe[] | null> {
    return this.db.getSlice<Recipe>(tenantId, "recipes");
  }

  async saveAll(tenantId: string, items: Recipe[], trx?: DatabaseTransaction): Promise<void> {
    if (trx) {
      await trx.saveSlice<Recipe>("recipes", items);
    } else {
      await this.db.saveSlice<Recipe>(tenantId, "recipes", items);
    }
  }

  async getByMenuItemId(tenantId: string, menuItemId: string): Promise<Recipe | null> {
    const items = await this.getAll(tenantId);
    if (!items) return null;
    return items.find(item => item.menuItemId === menuItemId) || null;
  }

  async addOrUpdate(tenantId: string, recipe: Recipe): Promise<void> {
    const items = (await this.getAll(tenantId)) || [];
    const index = items.findIndex(i => i.menuItemId === recipe.menuItemId);
    if (index !== -1) {
      items[index] = recipe;
    } else {
      items.push(recipe);
    }
    await this.saveAll(tenantId, items);
  }

  async delete(tenantId: string, menuItemId: string): Promise<void> {
    const items = (await this.getAll(tenantId)) || [];
    const exists = items.some(i => i.menuItemId === menuItemId);
    if (!exists) {
      throw new NotFoundError(`Recipe for menuItemId '${menuItemId}' not found for tenant '${tenantId}'.`);
    }
    const filtered = items.filter(i => i.menuItemId !== menuItemId);
    await this.saveAll(tenantId, filtered);
  }

  /**
   * Cascade unlinks a raw material (ingredientId) from all recipes for the tenant
   * Prevents orphan ingredient entries when a raw material is deleted.
   * Returns the count of recipes updated.
   */
  async unlinkIngredient(tenantId: string, ingredientId: string, trx?: DatabaseTransaction): Promise<number> {
    const items = (await this.getAll(tenantId)) || [];
    let modifiedCount = 0;
    const updated = items.map(recipe => {
      if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return recipe;
      const hasIngredient = recipe.ingredients.some(ri => ri.ingredientId === ingredientId);
      if (hasIngredient) {
        modifiedCount++;
        return {
          ...recipe,
          ingredients: recipe.ingredients.filter(ri => ri.ingredientId !== ingredientId),
          updated_at: new Date().toISOString(),
          version: (recipe.version || 1) + 1
        };
      }
      return recipe;
    });

    if (modifiedCount > 0) {
      await this.saveAll(tenantId, updated, trx);
    }
    return modifiedCount;
  }

  /**
   * Sanitizes all recipes for a tenant by removing ingredient references that don't exist in the valid set.
   * Self-heals orphan data.
   */
  async cleanOrphanIngredients(tenantId: string, validIngredientIds: Set<string>, trx?: DatabaseTransaction): Promise<{ modifiedRecipesCount: number; orphansRemovedCount: number }> {
    const items = (await this.getAll(tenantId)) || [];
    let modifiedRecipesCount = 0;
    let orphansRemovedCount = 0;

    const updated = items.map(recipe => {
      if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return recipe;
      const initialCount = recipe.ingredients.length;
      const validIngredients = recipe.ingredients.filter(ri => validIngredientIds.has(ri.ingredientId));
      if (validIngredients.length < initialCount) {
        modifiedRecipesCount++;
        orphansRemovedCount += (initialCount - validIngredients.length);
        return {
          ...recipe,
          ingredients: validIngredients,
          updated_at: new Date().toISOString(),
          version: (recipe.version || 1) + 1
        };
      }
      return recipe;
    });

    if (modifiedRecipesCount > 0) {
      await this.saveAll(tenantId, updated, trx);
    }
    return { modifiedRecipesCount, orphansRemovedCount };
  }
}
