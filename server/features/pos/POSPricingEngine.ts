import { menuRepo, customerRepo, settingsRepo, recipeRepo, ingredientRepo } from "../../context";
import { Order, OrderItem, MenuItem, Ingredient, Recipe, Customer } from "../../../src/features/shared/types";

export class FinancialValidationError extends Error {
  public code: string;
  public status: number;
  public statusCode: number;

  constructor(code: string, message: string, status: number = 400) {
    super(message);
    this.name = "FinancialValidationError";
    this.code = code;
    this.status = status;
    this.statusCode = status;
  }
}

export interface AuthoritativeOrderCalculation {
  validatedItems: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerUpdate?: {
    customer: Customer;
    newPoints: number;
    pointsEarned: number;
    pointsRedeemed: number;
  };
  inventoryDeductions: {
    ingredientId: string;
    ingredientName: string;
    quantityDeducted: number;
    previousStock: number;
    newStock: number;
  }[];
  updatedIngredients: Ingredient[];
}

export class POSPricingEngine {
  private static instance: POSPricingEngine;

  private constructor() {}

  public static getInstance(): POSPricingEngine {
    if (!POSPricingEngine.instance) {
      POSPricingEngine.instance = new POSPricingEngine();
    }
    return POSPricingEngine.instance;
  }

  /**
   * Performs complete server-authoritative pricing validation, tax calculation,
   * discount validation, and inventory deduction calculations.
   * Never trusts client-supplied subtotal, tax, discount, or total.
   */
  public async validateAndCalculateOrder(
    tenantId: string,
    rawOrder: Partial<Order> & {
      appliedDiscount?: number;
      redeemPoints?: boolean;
      selectedCustomerId?: string;
    }
  ): Promise<AuthoritativeOrderCalculation> {
    if (!tenantId) {
      throw new FinancialValidationError("MISSING_TENANT", "Tenant ID is required for financial calculations.", 403);
    }

    if (!rawOrder.items || !Array.isArray(rawOrder.items) || rawOrder.items.length === 0) {
      throw new FinancialValidationError("EMPTY_ORDER", "Order must contain at least one item.", 400);
    }

    // 1. Load authoritative menu items for the tenant
    const menuItems = (await menuRepo.getAll(tenantId)) || [];
    const menuMap = new Map<string, MenuItem>();
    for (const m of menuItems) {
      menuMap.set(m.id, m);
    }

    // 2. Validate items, quantities, and load authoritative prices
    const validatedItems: OrderItem[] = [];
    let calculatedSubtotal = 0;

    for (let i = 0; i < rawOrder.items.length; i++) {
      const item = rawOrder.items[i];
      const menuItemId = item.menuItemId || (item as any).menuItem?.id || (item as any).id;

      if (!menuItemId) {
        throw new FinancialValidationError("INVALID_MENU_ITEM", `Item at index ${i} is missing a menuItemId.`, 400);
      }

      const authoritativeMenuItem = menuMap.get(menuItemId);
      if (!authoritativeMenuItem) {
        throw new FinancialValidationError(
          "INVALID_MENU_ITEM",
          `Menu item '${menuItemId}' does not exist or does not belong to this restaurant.`,
          404
        );
      }

      if (!authoritativeMenuItem.isAvailable) {
        throw new FinancialValidationError(
          "ITEM_UNAVAILABLE",
          `Menu item '${authoritativeMenuItem.name}' is currently marked unavailable.`,
          400
        );
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new FinancialValidationError(
          "INVALID_QUANTITY",
          `Quantity for '${authoritativeMenuItem.name}' must be a positive whole number (received: ${item.quantity}).`,
          400
        );
      }

      if (quantity > 1000) {
        throw new FinancialValidationError(
          "QUANTITY_EXCEEDED",
          `Quantity for '${authoritativeMenuItem.name}' exceeds maximum limit of 1000.`,
          400
        );
      }

      // Authoritative unit price comes directly from the database menu item
      const unitPrice = authoritativeMenuItem.price;
      if (unitPrice < 0) {
        throw new FinancialValidationError("INVALID_PRICE", `Authoritative price for '${authoritativeMenuItem.name}' is negative.`, 500);
      }

      const itemSubtotal = Number((unitPrice * quantity).toFixed(2));
      calculatedSubtotal = Number((calculatedSubtotal + itemSubtotal).toFixed(2));

      validatedItems.push({
        id: `oi-${rawOrder.id || "temp"}-${i + 1}`,
        orderId: rawOrder.id || "",
        menuItemId: authoritativeMenuItem.id,
        name: authoritativeMenuItem.name,
        price: unitPrice,
        unitPrice: unitPrice,
        quantity,
        subtotal: itemSubtotal,
        notes: item.notes || (item as any).note ? String(item.notes || (item as any).note).slice(0, 200) : undefined,
        menuItem: authoritativeMenuItem
      } as any);
    }

    // 3. Authoritative Tax Calculation (5% GST for restaurant food services in India)
    const gstRate = 0.05;
    const calculatedTax = Number((calculatedSubtotal * gstRate).toFixed(2));

    // 4. Validate Discounts (Loyalty points & manual discount)
    let loyaltyDiscount = 0;
    let customerUpdate: AuthoritativeOrderCalculation["customerUpdate"] | undefined;

    const customerId = rawOrder.customerId || rawOrder.selectedCustomerId;
    if (customerId) {
      const customers = (await customerRepo.getAll(tenantId)) || [];
      const customer = customers.find((c) => c.id === customerId);

      if (customer) {
        if (rawOrder.redeemPoints) {
          // 1 point = 1 INR discount, capped at bill amount
          const maxRedeemable = Number((calculatedSubtotal + calculatedTax).toFixed(2));
          loyaltyDiscount = Math.min(Math.max(0, customer.loyaltyPoints || 0), maxRedeemable);
        }

        const earnedPoints = Math.floor(calculatedSubtotal / 100);
        const newPoints = Math.max(0, (customer.loyaltyPoints || 0) + earnedPoints - loyaltyDiscount);

        customerUpdate = {
          customer,
          newPoints,
          pointsEarned: earnedPoints,
          pointsRedeemed: loyaltyDiscount
        };
      }
    }

    let manualDiscount = 0;
    if (rawOrder.discount !== undefined || rawOrder.appliedDiscount !== undefined) {
      const requestedDiscount = Number(rawOrder.discount ?? rawOrder.appliedDiscount ?? 0);
      if (isNaN(requestedDiscount) || requestedDiscount < 0) {
        throw new FinancialValidationError("INVALID_DISCOUNT", "Discount amount cannot be negative.", 400);
      }

      // Max discount cannot exceed (subtotal + tax - loyaltyDiscount)
      const maxAllowedDiscount = Number((calculatedSubtotal + calculatedTax - loyaltyDiscount).toFixed(2));
      if (requestedDiscount > maxAllowedDiscount) {
        throw new FinancialValidationError(
          "DISCOUNT_EXCEEDS_TOTAL",
          `Discount (₹${requestedDiscount}) exceeds the allowable bill amount (₹${maxAllowedDiscount}).`,
          400
        );
      }
      manualDiscount = requestedDiscount;
    }

    const totalDiscount = Number((loyaltyDiscount + manualDiscount).toFixed(2));
    const calculatedTotal = Math.max(0, Number((calculatedSubtotal + calculatedTax - totalDiscount).toFixed(2)));

    // 5. Compare with client-provided totals if supplied (Defense against tampering)
    if (rawOrder.total !== undefined) {
      const clientTotal = Number(rawOrder.total);
      if (!isNaN(clientTotal) && Math.abs(clientTotal - calculatedTotal) > 0.05) {
        throw new FinancialValidationError(
          "FINANCIAL_TAMPERING_DETECTED",
          `Client-provided total (₹${clientTotal}) does not match authoritative calculated total (₹${calculatedTotal}). Request rejected.`,
          400
        );
      }
    }

    if (rawOrder.subtotal !== undefined) {
      const clientSubtotal = Number(rawOrder.subtotal);
      if (!isNaN(clientSubtotal) && Math.abs(clientSubtotal - calculatedSubtotal) > 0.05) {
        throw new FinancialValidationError(
          "FINANCIAL_TAMPERING_DETECTED",
          `Client-provided subtotal (₹${clientSubtotal}) does not match authoritative calculated subtotal (₹${calculatedSubtotal}). Request rejected.`,
          400
        );
      }
    }

    // 6. Server-Authoritative Inventory Requirements & Deduction Check
    const settings = (await settingsRepo.get(tenantId)) || ({} as any);
    const recipes = (await recipeRepo.getAll(tenantId)) || [];
    const ingredients = (await ingredientRepo.getAll(tenantId)) || [];
    const ingredientMap = new Map<string, Ingredient>();
    for (const ing of ingredients) {
      ingredientMap.set(ing.id, { ...ing });
    }

    // Aggregate required ingredient amounts across all items in order
    const requiredIngredientQuantities = new Map<string, { name: string; required: number }>();
    for (const ci of validatedItems) {
      const recipe = recipes.find((r) => r.menuItemId === ci.menuItemId);
      if (recipe && Array.isArray(recipe.ingredients)) {
        for (const ri of recipe.ingredients) {
          const needed = Number(ri.quantity) * ci.quantity;
          const current = requiredIngredientQuantities.get(ri.ingredientId) || {
            name: ri.ingredientId,
            required: 0
          };
          current.required += needed;
          requiredIngredientQuantities.set(ri.ingredientId, current);
        }
      }
    }

    // Verify stock availability if blockOrdersIfInsufficient is enabled
    const insufficientList: string[] = [];
    for (const [ingId, req] of requiredIngredientQuantities.entries()) {
      const ing = ingredientMap.get(ingId);
      if (!ing) continue;
      req.name = ing.name;
      if (settings.blockOrdersIfInsufficient && ing.currentStock < req.required) {
        insufficientList.push(`${ing.name} (Need: ${req.required}${ing.unit || ""}, In Stock: ${ing.currentStock}${ing.unit || ""})`);
      }
    }

    if (settings.blockOrdersIfInsufficient && insufficientList.length > 0) {
      throw new FinancialValidationError(
        "INSUFFICIENT_STOCK",
        `Cannot fulfill order due to insufficient ingredient stock: ${insufficientList.join(", ")}.`,
        400
      );
    }

    // Prepare atomic inventory deductions if autoDeductStock is enabled
    const inventoryDeductions: AuthoritativeOrderCalculation["inventoryDeductions"] = [];
    if (settings.autoDeductStock) {
      for (const [ingId, req] of requiredIngredientQuantities.entries()) {
        const ing = ingredientMap.get(ingId);
        if (ing) {
          const previousStock = ing.currentStock;
          const newStock = Math.max(0, Number((previousStock - req.required).toFixed(3)));
          ing.currentStock = newStock;
          ing.updated_at = new Date().toISOString();
          ing.version = (ing.version || 1) + 1;

          inventoryDeductions.push({
            ingredientId: ing.id,
            ingredientName: ing.name,
            quantityDeducted: req.required,
            previousStock,
            newStock
          });
        }
      }
    }

    return {
      validatedItems,
      subtotal: calculatedSubtotal,
      tax: calculatedTax,
      discount: totalDiscount,
      total: calculatedTotal,
      customerUpdate,
      inventoryDeductions,
      updatedIngredients: Array.from(ingredientMap.values())
    };
  }
}

export const posPricingEngine = POSPricingEngine.getInstance();
