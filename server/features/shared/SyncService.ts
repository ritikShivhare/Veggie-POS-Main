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
import { posPricingEngine } from "../pos/POSPricingEngine";
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
   * Extracts a comparable numeric millisecond timestamp from an entity record.
   * Checks updatedAt, updated_at, createdAt, created_at, or returns null.
   */
  private getRecordTimestamp(record: any): number | null {
    if (!record || typeof record !== "object") return null;
    const raw = record.updatedAt || record.updated_at || record.createdAt || record.created_at;
    if (!raw) return null;
    const ts = new Date(raw).getTime();
    return isNaN(ts) ? null : ts;
  }

  /**
   * Compares two entity records to detect if meaningful business fields have been modified,
   * ignoring version, updated_at, updatedAt, and accounting for bcrypt PIN hashes on staff.
   */
  private isRecordModified(sliceName: string, existing: any, incoming: any): boolean {
    const ignoreKeys = ["version", "updated_at", "updatedAt"];
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
   * Safely merges incoming items with existing server items preventing data-loss:
   * 1. Safe merging: Never drops existing server records missing from incoming payload (offline client safe merge).
   * 2. Timestamp check: Only updates server record if incoming has a strictly newer 'updatedAt' timestamp.
   * 3. Stale snapshot protection: Retains server's newer records when client submits older/stale snapshot.
   * 4. Version increments: Monotonically increments version on applied updates.
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
        updated_at: item.updated_at || item.updatedAt || new Date().toISOString()
      }));
    }

    const existingMap = new Map<string, T>();
    for (const item of existingItems) {
      const key = String(item[idKey] ?? (item as any).id ?? "");
      if (key) existingMap.set(key, item);
    }

    const processedKeys = new Set<string>();
    const result: T[] = [];

    for (const incoming of incomingItems) {
      const key = String(incoming[idKey] ?? (incoming as any).id ?? "");
      if (key) processedKeys.add(key);
      const existing = existingMap.get(key);

      // CASE 1: Brand new item created by client (e.g. offline created order)
      if (!existing) {
        result.push({
          ...incoming,
          version: typeof incoming.version === "number" ? incoming.version : 1,
          updated_at: incoming.updated_at || incoming.updatedAt || new Date().toISOString()
        });
        continue;
      }

      // CASE 2: Item exists both on server and in client payload
      const currentVersion = typeof existing.version === "number" ? existing.version : 1;
      const incomingVersion = incoming.version;

      const existingTimestamp = this.getRecordTimestamp(existing);
      const incomingTimestamp = this.getRecordTimestamp(incoming);

      // Check if any business field has changed
      const hasChanged = this.isRecordModified(sliceName, existing, incoming);

      if (!hasChanged) {
        // Record was not modified: preserve the existing authoritative server record
        result.push({
          ...existing,
          pin: (sliceName === "staff" && existing.pin) ? existing.pin : incoming.pin
        });
        continue;
      }

      // Business fields were modified:
      // Timestamp check: Only update a server record if the client's version has a strictly newer timestamp
      if (incomingTimestamp !== null && existingTimestamp !== null) {
        if (incomingTimestamp > existingTimestamp) {
          // Client has a newer timestamp -> accept update and increment version
          result.push({
            ...incoming,
            version: currentVersion + 1,
            updated_at: incoming.updated_at || incoming.updatedAt || new Date().toISOString()
          });
          continue;
        } else {
          // Client timestamp is older or equal -> Stale snapshot update!
          // DO NOT overwrite the newer server version with stale client data
          console.warn(
            `[SyncService] Stale record skipped for ${sliceName} [${key}]: client timestamp (${incoming.updatedAt || incoming.updated_at}) <= server timestamp (${existing.updated_at || existing.updatedAt}). Preserving server record.`
          );
          result.push(existing);
          continue;
        }
      }

      // If timestamps are not both available to compare, enforce optimistic version check
      if (incomingVersion !== undefined && incomingVersion !== currentVersion) {
        throw new OptimisticLockConflictError(
          `Optimistic lock conflict on '${sliceName}' for ${idKey} '${key}': client sent version ${incomingVersion}, but server current version is ${currentVersion}. Stale update rejected.`,
          { entityId: key, expectedVersion: incomingVersion, currentVersion }
        );
      }

      // Incoming version matches or was omitted
      result.push({
        ...incoming,
        version: currentVersion + 1,
        updated_at: new Date().toISOString()
      });
    }

    // CRITICAL DATA-LOSS PREVENTION:
    // Retain all existing server records that were NOT included in the incoming snapshot.
    // A stale client snapshot must NEVER delete newer or unmentioned server records.
    for (const [key, existing] of existingMap.entries()) {
      if (!processedKeys.has(key)) {
        result.push(existing);
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
      existingShifts,
      existingSettings
    ] = await Promise.all([
      payload.menuItems !== undefined ? this.menuRepo.getAll(tenantId) : Promise.resolve(null),
      payload.ingredients !== undefined ? this.ingredientRepo.getAll(tenantId) : Promise.resolve(null),
      payload.recipes !== undefined ? this.recipeRepo.getAll(tenantId) : Promise.resolve(null),
      payload.staffList !== undefined ? this.staffRepo.getAll(tenantId) : Promise.resolve(null),
      payload.orders !== undefined ? this.orderRepo.getAll(tenantId) : Promise.resolve(null),
      payload.customers !== undefined ? this.customerRepo.getAll(tenantId) : Promise.resolve(null),
      payload.purchases !== undefined ? this.purchaseRepo.getAll(tenantId) : Promise.resolve(null),
      payload.shifts !== undefined ? this.shiftRepo.getAll(tenantId) : Promise.resolve(null),
      payload.settings !== undefined ? this.settingsRepo.get(tenantId) : Promise.resolve(null)
    ]);

    // 2. Validate versions and apply conditional updates (rejects stale updates or preserves newer server state)
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

    // Validate orders authoritatively against tenant menu (enforced for both NEW and UPDATED orders)
    let ordersToStage = payload.orders;
    if (ordersToStage !== undefined && Array.isArray(ordersToStage)) {
      const sanitizedOrders: Order[] = [];
      const effectiveMenu = payload.menuItems || existingMenu || undefined;

      for (const ord of ordersToStage) {
        const existingOrd = (existingOrders || []).find((eo: any) => eo.id === ord.id);
        const itemsToValidate = (ord.items && ord.items.length > 0) ? ord.items : existingOrd?.items;

        if (!itemsToValidate || itemsToValidate.length === 0) {
          sanitizedOrders.push(ord);
          continue;
        }

        // Authoritatively validate and calculate order pricing for both new and existing updated orders.
        // Never allow the client to dictate total, subtotal, tax, or discount arbitrarily.
        try {
          const calc = await posPricingEngine.validateAndCalculateOrder(
            tenantId,
            { ...ord, items: itemsToValidate, recalculateTotals: true },
            undefined,
            effectiveMenu
          );
          sanitizedOrders.push({
            ...ord,
            items: calc.validatedItems.length > 0 ? calc.validatedItems : itemsToValidate,
            subtotal: calc.subtotal,
            tax: calc.tax,
            discount: calc.discount,
            total: calc.total
          });
        } catch (err: any) {
          if (err?.code === "CROSS_TENANT_VIOLATION" || err?.name === "CrossTenantViolationError") {
            throw err;
          }
          if (
            err?.name === "FinancialValidationError" ||
            err?.code === "PRICE_TAMPERING_DETECTED" ||
            err?.code === "FINANCIAL_TAMPERING_DETECTED" ||
            err?.code === "INVALID_MENU_ITEM" ||
            err?.code === "ITEM_UNAVAILABLE" ||
            err?.code === "INVALID_QUANTITY" ||
            err?.code === "QUANTITY_EXCEEDED"
          ) {
            throw err;
          }
          sanitizedOrders.push(ord);
        }
      }
      ordersToStage = sanitizedOrders;
    }

    const validatedOrders = ordersToStage !== undefined
      ? this.applyOptimisticLocking<Order>("orders", (existingOrders || []) as Order[], ordersToStage, "id")
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
        let settingsToSave = payload.settings;
        if (existingSettings) {
          const existingTs = this.getRecordTimestamp(existingSettings);
          const incomingTs = this.getRecordTimestamp(payload.settings);
          if (incomingTs !== null && existingTs !== null && incomingTs <= existingTs) {
            settingsToSave = { ...payload.settings, ...existingSettings };
          } else {
            settingsToSave = { ...existingSettings, ...payload.settings };
          }
        }
        await this.settingsRepo.save(tenantId, settingsToSave, trx);
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
