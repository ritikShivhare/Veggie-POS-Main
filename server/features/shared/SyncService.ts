import { MenuRepository } from "../pos/MenuRepository";
import { IngredientRepository } from "../inventory/IngredientRepository";
import { RecipeRepository } from "../inventory/RecipeRepository";
import { StaffRepository } from "../staff/StaffRepository";
import { OrderRepository } from "../pos/OrderRepository";
import { CustomerRepository } from "../crm/CustomerRepository";
import { PurchaseRepository } from "../inventory/PurchaseRepository";
import { ShiftRepository } from "../staff/ShiftRepository";
import { SettingsRepository } from "./SettingsRepository";
import { Database, OptimisticLockConflictError } from "./database";
import { realtimeService } from "./RealtimeService";
import bcrypt from "bcryptjs";
import { isBcryptHash } from "../auth/PinSecurityService";
import {
  MenuItem,
  Ingredient,
  Recipe,
  StaffMember,
  Order,
  Customer,
  Purchase,
  Shift
} from "../../../src/features/shared/types";

export class SyncService {
  private db: Database;

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
  ) {
    this.db = Database.getInstance();
  }

  /**
   * Compares two entity records to detect if meaningful business fields have been modified,
   * ignoring version, updated_at, and accounting for bcrypt PIN hashes on staff.
   */
  private isRecordModified(sliceName: string, existing: any, incoming: any): boolean {
    const ignoreKeys = ["version", "updated_at"];
    const allKeys = new Set([...Object.keys(existing || {}), ...Object.keys(incoming || {})]);

    for (const k of allKeys) {
      if (ignoreKeys.includes(k)) continue;

      const valE = existing ? existing[k] : undefined;
      const valI = incoming ? incoming[k] : undefined;

      // Check staff pin hashing equivalency
      if (sliceName === "staff" && k === "pin") {
        if (valI === valE) continue;
        if (typeof valI === "string" && typeof valE === "string" && isBcryptHash(valE)) {
          if (bcrypt.compareSync(valI, valE)) {
            continue; // PIN is identical to stored hash
          }
        }
        return true;
      }

      if (valE === undefined && valI === undefined) continue;

      if (JSON.stringify(valE) !== JSON.stringify(valI)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates incoming items against existing items using conditional version checks.
   * If an incoming item specifies a stale version, throws 409 OptimisticLockConflictError.
   * Increments version on modified items.
   */
  private applyOptimisticLocking<T extends Record<string, any>>(
    sliceName: string,
    existingItems: T[],
    incomingItems: T[],
    idKey: string = "id"
  ): T[] {
    if (!existingItems || existingItems.length === 0) {
      // First initialization or empty table: initialize version: 1
      return incomingItems.map((item) => ({
        ...item,
        version: typeof item.version === "number" ? item.version : 1,
        updated_at: item.updated_at || new Date().toISOString()
      }));
    }

    const existingMap = new Map<string, T>();
    for (const item of existingItems) {
      const key = String(item[idKey]);
      if (key) existingMap.set(key, item);
    }

    const result: T[] = [];
    for (const incoming of incomingItems) {
      const key = String(incoming[idKey]);
      const existing = existingMap.get(key);

      if (!existing) {
        // Brand new item: assign version 1
        result.push({
          ...incoming,
          version: typeof incoming.version === "number" ? incoming.version : 1,
          updated_at: incoming.updated_at || new Date().toISOString()
        });
        continue;
      }

      const currentVersion = typeof existing.version === "number" ? existing.version : 1;
      const incomingVersion = incoming.version;

      // Conditional update check: require WHERE id = ? AND version = ?
      if (incomingVersion !== undefined && incomingVersion !== currentVersion) {
        throw new OptimisticLockConflictError(
          `Optimistic lock conflict on '${sliceName}' for ${idKey} '${key}': client sent version ${incomingVersion}, but server current version is ${currentVersion}. Stale update rejected.`,
          { entityId: key, expectedVersion: incomingVersion, currentVersion }
        );
      }

      // Check if any business field has changed
      const hasChanged = this.isRecordModified(sliceName, existing, incoming);

      if (hasChanged) {
        result.push({
          ...incoming,
          version: currentVersion + 1,
          updated_at: new Date().toISOString()
        });
      } else {
        result.push({
          ...incoming,
          pin: (sliceName === "staff" && existing.pin) ? existing.pin : incoming.pin,
          version: currentVersion,
          updated_at: existing.updated_at || new Date().toISOString()
        });
      }
    }

    return result;
  }

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
    // 1. Fetch current slices for conditional optimistic update comparison
    const [
      existingMenu,
      existingIngredients,
      existingRecipes,
      existingStaff,
      existingOrders,
      existingCustomers,
      existingPurchases,
      existingShifts
    ] = await Promise.all([
      payload.menuItems !== undefined ? this.menuRepo.getAll(tenantId) : Promise.resolve(null),
      payload.ingredients !== undefined ? this.ingredientRepo.getAll(tenantId) : Promise.resolve(null),
      payload.recipes !== undefined ? this.recipeRepo.getAll(tenantId) : Promise.resolve(null),
      payload.staffList !== undefined ? this.staffRepo.getAll(tenantId) : Promise.resolve(null),
      payload.orders !== undefined ? this.orderRepo.getAll(tenantId) : Promise.resolve(null),
      payload.customers !== undefined ? this.customerRepo.getAll(tenantId) : Promise.resolve(null),
      payload.purchases !== undefined ? this.purchaseRepo.getAll(tenantId) : Promise.resolve(null),
      payload.shifts !== undefined ? this.shiftRepo.getAll(tenantId) : Promise.resolve(null)
    ]);

    // 2. Validate versions and apply conditional updates (rejects stale updates with 409)
    const validatedMenu = payload.menuItems !== undefined
      ? this.applyOptimisticLocking<MenuItem>("menu_items", (existingMenu || []) as MenuItem[], payload.menuItems, "id")
      : undefined;

    const validatedIngredients = payload.ingredients !== undefined
      ? this.applyOptimisticLocking<Ingredient>("ingredients", (existingIngredients || []) as Ingredient[], payload.ingredients, "id")
      : undefined;

    const validatedRecipes = payload.recipes !== undefined
      ? this.applyOptimisticLocking<Recipe>("recipes", (existingRecipes || []) as Recipe[], payload.recipes, "menuItemId")
      : undefined;

    const validatedStaff = payload.staffList !== undefined
      ? this.applyOptimisticLocking<StaffMember>("staff", (existingStaff || []) as StaffMember[], payload.staffList, "id")
      : undefined;

    const validatedOrders = payload.orders !== undefined
      ? this.applyOptimisticLocking<Order>("orders", (existingOrders || []) as Order[], payload.orders, "id")
      : undefined;

    const validatedCustomers = payload.customers !== undefined
      ? this.applyOptimisticLocking<Customer>("customers", (existingCustomers || []) as Customer[], payload.customers, "id")
      : undefined;

    const validatedPurchases = payload.purchases !== undefined
      ? this.applyOptimisticLocking<Purchase>("purchases", (existingPurchases || []) as Purchase[], payload.purchases, "id")
      : undefined;

    const validatedShifts = payload.shifts !== undefined
      ? this.applyOptimisticLocking<Shift>("shifts", (existingShifts || []) as Shift[], payload.shifts, "id")
      : undefined;

    // 3. Persist all related slices and settings inside a single atomic DB transaction
    // If any save fails, the entire transaction is rolled back
    await this.db.runTransaction(tenantId, async (trx) => {
      if (validatedMenu !== undefined) {
        await this.menuRepo.saveAll(tenantId, validatedMenu, trx);
      }
      if (validatedIngredients !== undefined) {
        await this.ingredientRepo.saveAll(tenantId, validatedIngredients, trx);
      }
      if (validatedRecipes !== undefined) {
        await this.recipeRepo.saveAll(tenantId, validatedRecipes, trx);
      }
      if (validatedStaff !== undefined) {
        await this.staffRepo.saveAll(tenantId, validatedStaff, trx);
      }
      if (validatedOrders !== undefined) {
        await this.orderRepo.saveAll(tenantId, validatedOrders, trx);
      }
      if (validatedCustomers !== undefined) {
        await this.customerRepo.saveAll(tenantId, validatedCustomers, trx);
      }
      if (validatedPurchases !== undefined) {
        await this.purchaseRepo.saveAll(tenantId, validatedPurchases, trx);
      }
      if (validatedShifts !== undefined) {
        await this.shiftRepo.saveAll(tenantId, validatedShifts, trx);
      }
      if (payload.settings !== undefined) {
        await this.settingsRepo.save(tenantId, payload.settings, trx);
      }
    });

    const fullState = await this.getFullState(tenantId);
    try {
      realtimeService.broadcastSyncUpdate(tenantId, "all");
    } catch (e) {
      console.warn("[SyncService] Realtime sync broadcast failed non-fatally:", e);
    }

    return fullState;
  }
}
