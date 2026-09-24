import { Database, DatabaseTransaction } from "../shared/database";
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
    const filtered = items.filter(i => i.menuItemId !== menuItemId);
    await this.saveAll(tenantId, filtered);
  }
}
