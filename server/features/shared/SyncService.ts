import { MenuRepository } from "../pos/MenuRepository";
import { IngredientRepository } from "../inventory/IngredientRepository";
import { RecipeRepository } from "../inventory/RecipeRepository";
import { StaffRepository } from "../staff/StaffRepository";
import { OrderRepository } from "../pos/OrderRepository";
import { CustomerRepository } from "../crm/CustomerRepository";
import { PurchaseRepository } from "../inventory/PurchaseRepository";
import { ShiftRepository } from "../staff/ShiftRepository";
import { SettingsRepository } from "./SettingsRepository";

export class SyncService {
  constructor(
    private menuRepo: MenuRepository,
    private ingredientRepo: IngredientRepository,
    private recipeRepo: RecipeRepository,
    private staffRepo: StaffRepository,
    private orderRepo: OrderRepository,
    private customerRepo: CustomerRepository,
    private purchaseRepo: PurchaseRepository,
    private shiftRepo: ShiftRepository,
    private settingsRepo: SettingsRepository
  ) {}

  async getFullState(tenantId: string): Promise<any> {
    const [
      menuItems,
      ingredients,
      recipes,
      staffList,
      orders,
      customers,
      purchases,
      shifts,
      settings
    ] = await Promise.all([
      this.menuRepo.getAll(tenantId),
      this.ingredientRepo.getAll(tenantId),
      this.recipeRepo.getAll(tenantId),
      this.staffRepo.getAll(tenantId),
      this.orderRepo.getAll(tenantId),
      this.customerRepo.getAll(tenantId),
      this.purchaseRepo.getAll(tenantId),
      this.shiftRepo.getAll(tenantId),
      this.settingsRepo.get(tenantId)
    ]);

    // If there is no menuItems or ingredients, the tenant's sync state is not initialized
    if (!menuItems && !ingredients) {
      return null;
    }

    return {
      menuItems,
      ingredients,
      recipes,
      staffList,
      orders,
      customers,
      purchases,
      shifts,
      settings
    };
  }

  async saveFullState(tenantId: string, payload: any): Promise<any> {
    // Save each slice via its respective repository
    await Promise.all([
      payload.menuItems !== undefined ? this.menuRepo.saveAll(tenantId, payload.menuItems) : Promise.resolve(),
      payload.ingredients !== undefined ? this.ingredientRepo.saveAll(tenantId, payload.ingredients) : Promise.resolve(),
      payload.recipes !== undefined ? this.recipeRepo.saveAll(tenantId, payload.recipes) : Promise.resolve(),
      payload.staffList !== undefined ? this.staffRepo.saveAll(tenantId, payload.staffList) : Promise.resolve(),
      payload.orders !== undefined ? this.orderRepo.saveAll(tenantId, payload.orders) : Promise.resolve(),
      payload.customers !== undefined ? this.customerRepo.saveAll(tenantId, payload.customers) : Promise.resolve(),
      payload.purchases !== undefined ? this.purchaseRepo.saveAll(tenantId, payload.purchases) : Promise.resolve(),
      payload.shifts !== undefined ? this.shiftRepo.saveAll(tenantId, payload.shifts) : Promise.resolve(),
      payload.settings !== undefined ? this.settingsRepo.save(tenantId, payload.settings) : Promise.resolve()
    ]);

    return this.getFullState(tenantId);
  }
}
