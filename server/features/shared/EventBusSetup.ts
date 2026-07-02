import { EventBus, AppEvent } from "./EventBus";
import { NotificationService } from "../notifications/NotificationService";
import { AuditLogService } from "./AuditLogService";
import { Database } from "./database";

export interface EventAnalytics {
  totalEventsProcessed: number;
  totalOrdersCompleted: number;
  totalPaymentsProcessed: number;
  totalRevenue: number;
  inventoryAdjustments: number;
  lastUpdated: string;
}

export function initializeEventSubscribers(): void {
  const eventBus = EventBus.getInstance();
  const notificationService = NotificationService.getInstance();
  const auditLogService = AuditLogService.getInstance();
  const db = Database.getInstance();

  console.log("[EventBusSetup] Initializing loosely-coupled event subscribers...");

  // ==========================================
  // 1. AUDIT LOGS SUBSCRIBER
  // ==========================================
  
  eventBus.subscribe("INVENTORY_UPDATE", async (event: AppEvent) => {
    const { itemName, changeAmount, newQuantity, updatedBy } = event.payload;
    const direction = changeAmount >= 0 ? "increased" : "decreased";
    await auditLogService.log(
      event.tenantId,
      "INVENTORY_UPDATE",
      updatedBy || "Inventory Manager",
      `Stock for '${itemName}' ${direction} by ${Math.abs(changeAmount)} units. New level: ${newQuantity} units.`,
      event.payload
    );
  });

  eventBus.subscribe("ORDER_COMPLETE", async (event: AppEvent) => {
    const { orderId, itemsCount, totalAmount, cashierName } = event.payload;
    await auditLogService.log(
      event.tenantId,
      "ORDER_COMPLETE",
      cashierName || "POS Checkout Terminal",
      `Order #${orderId} finalized with ${itemsCount} items. Bill subtotal: Rs. ${totalAmount}.`,
      event.payload
    );
  });

  eventBus.subscribe("PAYMENT_SUCCESS", async (event: AppEvent) => {
    const { transactionId, orderId, amount, method, payerName } = event.payload;
    await auditLogService.log(
      event.tenantId,
      "PAYMENT_SUCCESS",
      "UPI payment gateway",
      `Payment reference ${transactionId} verified successfully for Rs. ${amount} via ${method}.`,
      { transactionId, orderId, amount, method, payerName }
    );
  });

  // ==========================================
  // 2. AUTOMATIC NOTIFICATIONS SUBSCRIBER
  // ==========================================

  eventBus.subscribe("INVENTORY_UPDATE", async (event: AppEvent) => {
    const { itemName, changeAmount, newQuantity } = event.payload;
    
    // Check if stock has fallen into a warning state
    if (newQuantity <= 15) {
      await notificationService.send(event.tenantId, {
        title: `Low Stock Alert: ${itemName}`,
        message: `System threshold alert: ${itemName} is running low. Only ${newQuantity} units left in the ledger!`,
        severity: "warning",
        channels: ["in-app", "email"],
        recipientEmail: "kitchen.inventory@vegrest.com"
      });
    } else {
      await notificationService.send(event.tenantId, {
        title: `Inventory Adjusted`,
        message: `Supplies level updated: ${itemName} adjusted by ${changeAmount} units. Current level: ${newQuantity}.`,
        severity: "info",
        channels: ["in-app"]
      });
    }
  });

  eventBus.subscribe("ORDER_COMPLETE", async (event: AppEvent) => {
    const { orderId, totalAmount, customerEmail } = event.payload;
    await notificationService.send(event.tenantId, {
      title: `Order #${orderId} Completed`,
      message: `POS Checkout completed successfully! Total billing: Rs. ${totalAmount}. Ready for preparation in kitchen.`,
      severity: "success",
      channels: ["in-app", "email"],
      recipientEmail: customerEmail || "admin.billing@vegrest.com"
    });
  });

  eventBus.subscribe("PAYMENT_SUCCESS", async (event: AppEvent) => {
    const { orderId, amount, method, customerPhone, customerEmail } = event.payload;
    await notificationService.send(event.tenantId, {
      title: `Payment Received - Rs. ${amount}`,
      message: `Transaction verified for Order #${orderId} using ${method}. A digital receipt has been routed.`,
      severity: "success",
      channels: ["in-app", "sms", "email"],
      recipientEmail: customerEmail || "finance.ledger@vegrest.com",
      recipientPhone: customerPhone || "+91 99999 11111"
    });
  });

  // ==========================================
  // 3. LIVE DASHBOARD ANALYTICS SUBSCRIBER
  // ==========================================

  const updateAnalytics = async (tenantId: string, eventType: "INVENTORY" | "ORDER" | "PAYMENT", value = 0) => {
    const current: EventAnalytics = (await db.getObject<EventAnalytics>(tenantId, "system_event_analytics")) || {
      totalEventsProcessed: 0,
      totalOrdersCompleted: 0,
      totalPaymentsProcessed: 0,
      totalRevenue: 0,
      inventoryAdjustments: 0,
      lastUpdated: new Date().toISOString()
    };

    current.totalEventsProcessed += 1;
    current.lastUpdated = new Date().toISOString();

    if (eventType === "ORDER") {
      current.totalOrdersCompleted += 1;
    } else if (eventType === "PAYMENT") {
      current.totalPaymentsProcessed += 1;
      current.totalRevenue += value;
    } else if (eventType === "INVENTORY") {
      current.inventoryAdjustments += 1;
    }

    await db.saveObject(tenantId, "system_event_analytics", current);
    console.log(`[EventBus] Dashboard analytics updated for tenant: ${tenantId}`);
  };

  eventBus.subscribe("INVENTORY_UPDATE", async (event: AppEvent) => {
    await updateAnalytics(event.tenantId, "INVENTORY");
  });

  eventBus.subscribe("ORDER_COMPLETE", async (event: AppEvent) => {
    await updateAnalytics(event.tenantId, "ORDER");
  });

  eventBus.subscribe("PAYMENT_SUCCESS", async (event: AppEvent) => {
    const { amount } = event.payload;
    await updateAnalytics(event.tenantId, "PAYMENT", Number(amount) || 0);
  });
}
