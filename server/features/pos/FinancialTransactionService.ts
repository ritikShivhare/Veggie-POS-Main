import {assertOrderCreation,assertSettlement,assertKotMutable,getSubscription} from '../billing/SubscriptionLifecycle';
import {operationalAlerts} from '../notifications/OperationalAlerts';
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
import crypto from "node:crypto";

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

    return Database.getInstance().runTransaction(tenantId, async (trx) => {
    const existing = rawOrder.id ? await orderRepo.getById(tenantId, rawOrder.id) : null;
    if (existing) return {order:existing,items:await (await this.orderItemRepo.getAll(tenantId) || []).filter(i=>i.orderId===existing.id),payment:(await this.paymentRepo.getAll(tenantId))?.find(p=>p.orderId===existing.id)};
    await assertOrderCreation(tenantId,rawOrder);
    if (rawOrder.paymentMethod && !["Cash","UPI"].includes(rawOrder.paymentMethod)) throw new FinancialValidationError("INVALID_PAYMENT_METHOD","Choose Cash or UPI.");
    if (rawOrder.status && !["Pending","Preparing","Completed"].includes(rawOrder.status)) throw new FinancialValidationError("INVALID_ORDER_STATUS","Invalid initial order status.");
    // Pricing and stock reads happen inside the transaction, including on retry.
    const calculation = await posPricingEngine.validateAndCalculateOrder(tenantId, rawOrder, userContext);

    const orderId = rawOrder.id || `ord-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const isPaidImmediately = Boolean(rawOrder.paymentMethod && (rawOrder.status === "Completed" || !rawOrder.status));

    const finalOrder: Order = {
      id: orderId,
      orderNumber: rawOrder.orderNumber || `#${Date.now().toString(36)}-${crypto.randomUUID().slice(0,8)}`,
      date: rawOrder.date || nowIso,
      type: rawOrder.type || "Dine-In",
      tableNo: rawOrder.tableNo,
      customerId: rawOrder.customerId || rawOrder.selectedCustomerId,
      customerName: rawOrder.customerName || (calculation.customerUpdate ? calculation.customerUpdate.customer.name : undefined),
      items: calculation.validatedItems.map((i: any)=>({menuItem:i.menuItem, menuItemId:i.menuItemId,quantity:i.quantity,note:i.notes})),
      subtotal: calculation.subtotal,
      tax: calculation.tax,
      discount: calculation.discount,
      total: calculation.total,
      status: isPaidImmediately ? "Completed" : (rawOrder.status || "Pending"),
      paymentMethod: isPaidImmediately ? rawOrder.paymentMethod : undefined,
      paidAt: isPaidImmediately ? nowIso : undefined,
      cashierId: userContext?.staffId || rawOrder.cashierId,
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
          performedBy: finalOrder.cashierId,
          created_at: nowIso,
          updated_at: nowIso,
          version: 1
        });
      }
    }

    // 2. ATOMIC TRANSACTION EXECUTION
    // All staged writes commit together.
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
        (finalOrder as any).redeemedPoints = calculation.customerUpdate.pointsRedeemed;
        (finalOrder as any).earnedPoints = calculation.customerUpdate.pointsEarned;
        await orderRepo.update(tenantId, finalOrder, undefined, trx);
        const updatedCustomer: Customer = {
          ...c,
          loyaltyPoints: Math.max(0,c.loyaltyPoints-calculation.customerUpdate.pointsRedeemed+(isPaidImmediately?calculation.customerUpdate.pointsEarned:0)),
          totalSpend: Number(((c.totalSpend || 0) + (isPaidImmediately?calculation.total:0)).toFixed(2)),
          totalVisits: (c.totalVisits || 0) + (isPaidImmediately?1:0),
          lastVisited: isPaidImmediately?nowIso:c.lastVisited
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
    await operationalAlerts.newOrder(tenantId,finalOrder);
    return { order: finalOrder, items: orderItemsToInsert, payment: paymentRecord };
    });
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

    return Database.getInstance().runTransaction(tenantId, async (trx) => {
    await assertSettlement(tenantId,orderId);
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
    if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
      throw new FinancialValidationError("INVALID_PAYMENT_AMOUNT", "Payment amount must be greater than zero.", 400);
    }

    if (Math.abs(paymentAmount - order.total) > 0.05) {
      throw new FinancialValidationError(
        "INVALID_PAYMENT_AMOUNT",
        `Payment amount (₹${paymentAmount}) does not match authoritative order total (₹${order.total}).`,
        400
      );
    }

    if (!["Cash","UPI"].includes(paymentDetails.paymentMethod)) throw new FinancialValidationError("INVALID_PAYMENT_METHOD","Choose Cash or UPI.");
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

    // All staged writes commit together.
      // 1. Insert Payment
      await this.paymentRepo.add(tenantId, paymentRecord, trx);

      // 2. Update Order Status
      await orderRepo.update(tenantId, updatedOrder, order.version, trx);

      if (order.customerId) {
        const c = await customerRepo.getById(tenantId,order.customerId);
        if (c) await customerRepo.update(tenantId,{...c,loyaltyPoints:c.loyaltyPoints+((order as any).earnedPoints || 0),totalSpend:Number((c.totalSpend+paymentAmount).toFixed(2)),totalVisits:c.totalVisits+1,lastVisited:nowIso},undefined,trx);
      }
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
    return {order: updatedOrder,payment:paymentRecord};
    });
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
      refundConfirmed?: boolean;
      staffId?: string;
    }
  ): Promise<Order> {
    if (!tenantId) {
      throw new CrossTenantViolationError("Tenant identity is required for order cancellation.");
    }

    return Database.getInstance().runTransaction(tenantId, async (trx) => {
    await assertKotMutable(tenantId,orderId);
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

    const payments = (await this.paymentRepo.getAll(tenantId)) || [];
    const orderPayments = payments.filter(p => p.orderId === orderId && p.status === "Completed");
    // Older installations stored paid bills without a settlement ledger. They
    // cannot bypass the refund check by presenting an empty payment collection.
    if (order.paidAt && !orderPayments.length) {
      throw new FinancialValidationError("LEGACY_SETTLEMENT_REQUIRES_RECONCILIATION","This paid bill has no original payment record. Review its payment history before cancelling.");
    }
    if (orderPayments.length && !cancelDetails.refundConfirmed) throw new FinancialValidationError("REFUND_CONFIRMATION_REQUIRED","Refund the customer manually, then confirm the refund before cancelling.");

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

    const ingredients = (await ingredientRepo.getAll(tenantId)) || [];
    const ingredientMap = new Map(ingredients.map(i=>[i.id,{...i}]));
    const previousMovements = (await this.inventoryMovementRepo.getAll(tenantId)) || [];
    const returnMovements: InventoryMovement[] = [];
    // Reverse exactly the original committed stock movements, not today's recipe.
    if((await getSubscription(tenantId)).inventoryFrozen && previousMovements.some(m=>m.referenceId===orderId && m.movementType==="SALE_DEDUCTION")) throw new FinancialValidationError("INVENTORY_FROZEN","Inventory is frozen; upgrade before reversing stock movements.",403);
    for (const sale of previousMovements.filter(m=>m.referenceId===orderId && m.movementType==="SALE_DEDUCTION")) {
      if (previousMovements.some(m=>m.id===`return-${sale.id}`)) continue;
      const ing = ingredientMap.get(sale.ingredientId);
      if (!ing) throw new FinancialValidationError("MISSING_INGREDIENT","Original stock ingredient no longer exists.");
      const previousStock = ing.currentStock;
      ing.currentStock = Number((previousStock-sale.quantityDelta).toFixed(4));
      ing.version = (ing.version || 1)+1; ing.updated_at = nowIso;
      returnMovements.push({id:`return-${sale.id}`,ingredientId:ing.id,movementType:"RETURN",quantityDelta:-sale.quantityDelta,previousStock,newStock:ing.currentStock,referenceId:orderId,reason:cancelDetails.reason,performedBy:cancelDetails.staffId,version:1,created_at:nowIso,updated_at:nowIso});
    }

    // Check payments for this order to mark as Refunded
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

    // All staged writes commit together.
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

      if (order.customerId) {
        const c = await customerRepo.getById(tenantId,order.customerId);
        if (c) await customerRepo.update(tenantId,{...c,loyaltyPoints:Math.max(0,c.loyaltyPoints+((order as any).redeemedPoints || 0)-(orderPayments.length?((order as any).earnedPoints || 0):0)),totalSpend:Math.max(0,Number((c.totalSpend-(orderPayments.length?order.total:0)).toFixed(2))),totalVisits:Math.max(0,c.totalVisits-(orderPayments.length?1:0))},undefined,trx);
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
    return updatedOrder;
    });
  }
}

export const financialTransactionService = FinancialTransactionService.getInstance();
