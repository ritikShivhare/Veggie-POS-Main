import { Database, NotFoundError, CrossTenantViolationError, DatabaseUnavailableError, OptimisticLockConflictError } from "../shared/database";
import { posPricingEngine, FinancialValidationError } from "./POSPricingEngine";
import {
  orderRepo,
  ingredientRepo,
  recipeRepo,
  customerRepo,
  auditLogService,
  realtimeService
} from "../../context";
import { OrderItemRepository } from "./OrderItemRepository";
import { PaymentRepository } from "./PaymentRepository";
import { InventoryMovementRepository } from "../inventory/InventoryMovementRepository";
import { Order, OrderItem, Payment, InventoryMovement, Customer, Ingredient } from "../../../src/features/shared/types";

export class OrderAlreadyPaidError extends Error {
  public code = "ORDER_ALREADY_PAID";
  public status = 400;
  public statusCode = 400;
  constructor(message: string = "This order has already been paid and settled.") {
    super(message);
    this.name = "OrderAlreadyPaidError";
  }
}

export class OrderAlreadyCancelledError extends Error {
  public code = "ORDER_ALREADY_CANCELLED";
  public status = 400;
  public statusCode = 400;
  constructor(message: string = "This order is already cancelled.") {
    super(message);
    this.name = "OrderAlreadyCancelledError";
  }
}

export class FinancialTransactionService {
  private static instance: FinancialTransactionService;
  private orderItemRepo = new OrderItemRepository();
  private paymentRepo = new PaymentRepository();
  private inventoryMovementRepo = new InventoryMovementRepository();

  private constructor() {}

  public static getInstance(): FinancialTransactionService {
    if (!FinancialTransactionService.instance) {
      FinancialTransactionService.instance = new FinancialTransactionService();
    }
    return FinancialTransactionService.instance;
  }

  public getOrderItemRepo(): OrderItemRepository {
    return this.orderItemRepo;
  }

  public getPaymentRepo(): PaymentRepository {
    return this.paymentRepo;
  }

  public getInventoryMovementRepo(): InventoryMovementRepository {
    return this.inventoryMovementRepo;
  }

  /**
   * Executes complete server-authoritative order placement within an atomic transaction.
   * Creates Order, OrderItems, Payment (if settled), InventoryMovements (if auto-deduct enabled),
   * Customer updates, and Audit log within a single ACID transaction boundary.
   */
  public async executeOrderPlacement(
    tenantId: string,
    rawOrder: Partial<Order> & {
      appliedDiscount?: number;
      redeemPoints?: boolean;
      selectedCustomerId?: string;
      managerPin?: string;
      paymentAmount?: number;
    },
    userContext?: {
      role?: string;
      permissions?: string[];
      staffId?: string;
      staffName?: string;
    }
  ): Promise<{ order: Order; items: OrderItem[]; payment?: Payment }> {
    if (!tenantId) {
      throw new CrossTenantViolationError("Tenant identity is required for order creation.");
    }

    if (Database.getInstance().isDatabaseStopped()) {
      throw new DatabaseUnavailableError("Database is unavailable (database is stopped). Cannot persist order.");
    }

    // 1. Authoritative calculation & validation
    const calculation = await posPricingEngine.validateAndCalculateOrder(tenantId, rawOrder, userContext);

    const orderId = rawOrder.id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const isPaidImmediately = Boolean(rawOrder.paymentMethod && (rawOrder.status === "Completed" || !rawOrder.status));

    const finalOrder: Order = {
      id: orderId,
      orderNumber: rawOrder.orderNumber || `#${Math.floor(1000 + Math.random() * 9000)}`,
      date: rawOrder.date || nowIso,
      type: rawOrder.type || "Dine-In",
      tableNo: rawOrder.tableNo,
      customerId: rawOrder.customerId || rawOrder.selectedCustomerId,
      customerName: rawOrder.customerName || (calculation.customerUpdate ? calculation.customerUpdate.customer.name : undefined),
      items: rawOrder.items as any,
      subtotal: calculation.subtotal,
      tax: calculation.tax,
      discount: calculation.discount,
      total: calculation.total,
      status: isPaidImmediately ? "Completed" : (rawOrder.status || "Pending"),
      paymentMethod: isPaidImmediately ? rawOrder.paymentMethod : undefined,
      paidAt: isPaidImmediately ? nowIso : undefined,
      cashierId: userContext?.staffId || rawOrder.cashierId || "cashier",
      cashierName: userContext?.staffName || rawOrder.cashierName || "Cashier",
      version: 1,
      created_at: nowIso,
      updated_at: nowIso
    };

    // Attach orderId to validated order items
    const orderItemsToInsert: OrderItem[] = calculation.validatedItems.map((item, idx) => ({
      ...item,
      id: item.id && !item.id.includes("temp") ? item.id : `oi-${orderId}-${idx + 1}`,
      orderId,
      created_at: nowIso,
      updated_at: nowIso,
      version: 1
    }));

    let paymentRecord: Payment | undefined;
    if (isPaidImmediately) {
      paymentRecord = {
        id: `pay-${orderId}`,
        orderId,
        amount: calculation.total,
        paymentMethod: rawOrder.paymentMethod!,
        status: "Completed",
        transactionReference: (rawOrder as any).transactionReference,
        cashierId: finalOrder.cashierId,
        version: 1,
        created_at: nowIso,
        updated_at: nowIso
      };
    }

    // Prepare inventory movements
    const inventoryMovementsToInsert: InventoryMovement[] = [];
    if (calculation.inventoryDeductions && calculation.inventoryDeductions.length > 0) {
      for (const deduction of calculation.inventoryDeductions) {
        inventoryMovementsToInsert.push({
          id: `mov-${orderId}-${deduction.ingredientId}-${Date.now()}`,
          ingredientId: deduction.ingredientId,
          movementType: "SALE_DEDUCTION",
          quantityDelta: -deduction.quantityDeducted,
          previousStock: deduction.previousStock,
          newStock: deduction.newStock,
          referenceId: orderId,
          reason: `Sale deduction for order ${finalOrder.orderNumber}`,
          performedBy: finalOrder.cashierName,
          created_at: nowIso,
          updated_at: nowIso,
          version: 1
        });
      }
    }

    // 2. ATOMIC TRANSACTION EXECUTION
    const db = Database.getInstance();
    await db.runTransaction(tenantId, async (trx) => {
      // 2a. Insert Order
      await orderRepo.add(tenantId, finalOrder, trx);

      // 2b. Insert Order Items
      const existingItems = (await this.orderItemRepo.getAll(tenantId)) || [];
      await this.orderItemRepo.saveAll(tenantId, [...existingItems, ...orderItemsToInsert], trx);

      // 2c. Insert Payment if applicable
      if (paymentRecord) {
        await this.paymentRepo.add(tenantId, paymentRecord, trx);
      }

      // 2d. Deduct Inventory and Record Inventory Movements
      if (calculation.updatedIngredients && calculation.updatedIngredients.length > 0) {
        await ingredientRepo.saveAll(tenantId, calculation.updatedIngredients, trx);
      }
      if (inventoryMovementsToInsert.length > 0) {
        const existingMovements = (await this.inventoryMovementRepo.getAll(tenantId)) || [];
        await this.inventoryMovementRepo.saveAll(tenantId, [...existingMovements, ...inventoryMovementsToInsert], trx);
      }

      // 2e. Update Customer Loyalty Points and Spend if applicable
      if (calculation.customerUpdate) {
        const c = calculation.customerUpdate.customer;
        const updatedCustomer: Customer = {
          ...c,
          loyaltyPoints: calculation.customerUpdate.newPoints,
          totalSpend: Number(((c.totalSpend || 0) + calculation.total).toFixed(2)),
          totalVisits: (c.totalVisits || 0) + 1,
          lastVisited: nowIso
        };
        await customerRepo.update(tenantId, updatedCustomer, undefined, trx);
      }

      // 2f. Append Audit Trail Entry
      await auditLogService.log(
        tenantId,
        isPaidImmediately ? "ORDER_CREATED_AND_PAID" : "ORDER_CREATED",
        finalOrder.cashierName,
        `Order ${finalOrder.orderNumber} placed for ₹${finalOrder.total} (${finalOrder.items.length} items). Status: ${finalOrder.status}`,
        {
          orderId: finalOrder.id,
          orderNumber: finalOrder.orderNumber,
          total: finalOrder.total,
          subtotal: finalOrder.subtotal,
          tax: finalOrder.tax,
          discount: finalOrder.discount,
          paymentMethod: finalOrder.paymentMethod,
          itemCount: finalOrder.items.length
        },
        trx
      );
    });

    return {
      order: finalOrder,
      items: orderItemsToInsert,
      payment: paymentRecord
    };
  }

  /**
   * Executes payment settlement for an existing order within an atomic transaction.
   * Validates tenant isolation, verifies order is not already paid, validates payment amount,
   * creates Payment record, updates Order status to 'Completed', and logs audit trail.
   */
  public async executeOrderPayment(
    tenantId: string,
    orderId: string,
    paymentDetails: {
      amount: number;
      paymentMethod: "Cash" | "UPI" | "Card" | string;
      transactionReference?: string;
      cashierId?: string;
      cashierName?: string;
    }
  ): Promise<{ order: Order; payment: Payment }> {
    if (!tenantId) {
      throw new CrossTenantViolationError("Tenant identity is required for payment.");
    }

    const order = await orderRepo.getById(tenantId, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found for tenant '${tenantId}'.`);
    }

    if (order.status === "Cancelled") {
      throw new FinancialValidationError("ORDER_CANCELLED", "Cannot pay a cancelled order.", 400);
    }

    if (order.status === "Completed" && order.paidAt) {
      throw new OrderAlreadyPaidError(`Order '${order.orderNumber}' is already completed and paid at ${order.paidAt}.`);
    }

    // Verify amount matches authoritative order total
    const paymentAmount = Number(paymentDetails.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new FinancialValidationError("INVALID_PAYMENT_AMOUNT", "Payment amount must be greater than zero.", 400);
    }

    if (Math.abs(paymentAmount - order.total) > 0.05) {
      throw new FinancialValidationError(
        "INVALID_PAYMENT_AMOUNT",
        `Payment amount (₹${paymentAmount}) does not match authoritative order total (₹${order.total}).`,
        400
      );
    }

    const nowIso = new Date().toISOString();
    const paymentId = `pay-${order.id}-${Date.now()}`;
    const paymentRecord: Payment = {
      id: paymentId,
      orderId: order.id,
      amount: paymentAmount,
      paymentMethod: paymentDetails.paymentMethod,
      status: "Completed",
      transactionReference: paymentDetails.transactionReference,
      cashierId: paymentDetails.cashierId || order.cashierId,
      version: 1,
      created_at: nowIso,
      updated_at: nowIso
    };

    const updatedOrder: Order = {
      ...order,
      status: "Completed",
      paymentMethod: paymentDetails.paymentMethod as any,
      paidAt: nowIso,
      updated_at: nowIso,
      version: (order.version || 1) + 1
    };

    const db = Database.getInstance();
    await db.runTransaction(tenantId, async (trx) => {
      // 1. Insert Payment
      await this.paymentRepo.add(tenantId, paymentRecord, trx);

      // 2. Update Order Status
      await orderRepo.update(tenantId, updatedOrder, order.version, trx);

      // 3. Log Audit Trail
      await auditLogService.log(
        tenantId,
        "ORDER_PAID",
        paymentDetails.cashierName || order.cashierName,
        `Payment of ₹${paymentAmount} via ${paymentDetails.paymentMethod} processed for Order ${order.orderNumber}.`,
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentId,
          amount: paymentAmount,
          method: paymentDetails.paymentMethod,
          transactionRef: paymentDetails.transactionReference
        },
        trx
      );
    });

    return {
      order: updatedOrder,
      payment: paymentRecord
    };
  }

  /**
   * Executes atomic cancellation of an order.
   * If inventory was auto-deducted, restocks ingredients and records RETURN inventory movements.
   * If payments were recorded, marks them as 'Refunded'.
   */
  public async executeOrderCancellation(
    tenantId: string,
    orderId: string,
    cancelDetails: {
      cancelledBy: string;
      reason: string;
      expectedVersion?: number;
    }
  ): Promise<Order> {
    if (!tenantId) {
      throw new CrossTenantViolationError("Tenant identity is required for order cancellation.");
    }

    const order = await orderRepo.getById(tenantId, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found for tenant '${tenantId}'.`);
    }

    if (order.status === "Cancelled") {
      throw new OrderAlreadyCancelledError(`Order '${order.orderNumber}' is already cancelled.`);
    }

    const currentVersion = typeof order.version === "number" ? order.version : 1;
    if (cancelDetails.expectedVersion !== undefined && cancelDetails.expectedVersion !== currentVersion) {
      throw new OptimisticLockConflictError(
        `Optimistic lock conflict on table 'orders' for id '${orderId}': expected version was ${cancelDetails.expectedVersion}, but current version is ${currentVersion}.`,
        { entityId: orderId, expectedVersion: cancelDetails.expectedVersion, currentVersion }
      );
    }

    const nowIso = new Date().toISOString();
    const updatedOrder: Order = {
      ...order,
      status: "Cancelled",
      updated_at: nowIso,
      version: (order.version || 1) + 1
    };
    (updatedOrder as any).cancellationReason = cancelDetails.reason;
    (updatedOrder as any).cancelledBy = cancelDetails.cancelledBy;
    (updatedOrder as any).cancelledAt = nowIso;

    // Check if recipes and ingredients need restocking
    const recipes = (await recipeRepo.getAll(tenantId)) || [];
    const ingredients = (await ingredientRepo.getAll(tenantId)) || [];
    const ingredientMap = new Map<string, Ingredient>();
    for (const ing of ingredients) {
      ingredientMap.set(ing.id, { ...ing });
    }

    const returnMovements: InventoryMovement[] = [];
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        const mId = (item as any).menuItemId || (item as any).menuItem?.id;
        const recipe = recipes.find(r => r.menuItemId === mId);
        if (recipe && Array.isArray(recipe.ingredients)) {
          for (const ri of recipe.ingredients) {
            const ing = ingredientMap.get(ri.ingredientId);
            if (ing) {
              const returnQty = Number(ri.quantity) * Number(item.quantity);
              const previousStock = ing.currentStock;
              const newStock = Number((previousStock + returnQty).toFixed(3));
              ing.currentStock = newStock;
              ing.updated_at = nowIso;
              ing.version = (ing.version || 1) + 1;

              returnMovements.push({
                id: `mov-ret-${order.id}-${ing.id}-${Date.now()}`,
                ingredientId: ing.id,
                movementType: "RETURN",
                quantityDelta: returnQty,
                previousStock,
                newStock,
                referenceId: order.id,
                reason: `Restock due to cancellation of Order ${order.orderNumber}: ${cancelDetails.reason}`,
                performedBy: cancelDetails.cancelledBy,
                created_at: nowIso,
                updated_at: nowIso,
                version: 1
              });
            }
          }
        }
      }
    }

    // Check payments for this order to mark as Refunded
    const payments = (await this.paymentRepo.getAll(tenantId)) || [];
    const orderPayments = payments.filter(p => p.orderId === orderId && p.status === "Completed");
    const updatedPayments = payments.map(p => {
      if (p.orderId === orderId && p.status === "Completed") {
        return {
          ...p,
          status: "Refunded",
          updated_at: nowIso,
          version: (p.version || 1) + 1
        };
      }
      return p;
    });

    const db = Database.getInstance();
    await db.runTransaction(tenantId, async (trx) => {
      // 1. Update Order
      await orderRepo.update(tenantId, updatedOrder, order.version, trx);

      // 2. Restock ingredients if applicable
      if (returnMovements.length > 0) {
        await ingredientRepo.saveAll(tenantId, Array.from(ingredientMap.values()), trx);
        const existingMovements = (await this.inventoryMovementRepo.getAll(tenantId)) || [];
        await this.inventoryMovementRepo.saveAll(tenantId, [...existingMovements, ...returnMovements], trx);
      }

      // 3. Update payments to Refunded if applicable
      if (orderPayments.length > 0) {
        await this.paymentRepo.saveAll(tenantId, updatedPayments, trx);
      }

      // 4. Log Audit Trail
      await auditLogService.log(
        tenantId,
        "ORDER_CANCELLED",
        cancelDetails.cancelledBy,
        `Order ${order.orderNumber} (₹${order.total}) cancelled by ${cancelDetails.cancelledBy}. Reason: "${cancelDetails.reason}"`,
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          reason: cancelDetails.reason,
          cancelledBy: cancelDetails.cancelledBy,
          restockedItemsCount: returnMovements.length,
          refundedPaymentsCount: orderPayments.length
        },
        trx
      );
    });

    return updatedOrder;
  }
}

export const financialTransactionService = FinancialTransactionService.getInstance();
