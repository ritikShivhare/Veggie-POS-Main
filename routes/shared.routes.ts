import {runAiReport} from '../server/features/billing/SubscriptionLifecycle';
import {operationalAlerts} from '../server/features/notifications/OperationalAlerts';
import express from "express";
import { validateSettings } from "../server/features/shared/validation";
import { publicState,publicTenant,publicSettings } from "../server/features/shared/security";
import { Database, handleApiError } from "../server/features/shared/database";
import { redisCacheService } from "../server/features/shared/RedisCacheService";
import {
  settingsRepo,
  syncService,
  reportService,
  copilotService,
  jobsService,
  notificationService,
  eventBus,
  auditLogService,
  monitoringService,
  authMiddleware,
  idempotencyMiddleware,
  requirePermission,
  requireRole,
  orderRepo,
  ingredientRepo,
  shiftRepo,
  orderItemRepo, paymentRepo, inventoryMovementRepo, getGlobalTenantsList
} from "../server/context";

const router = express.Router();

// ============================================================================
// REST ENDPOINTS: SETTINGS
// ============================================================================
router.get("/settings", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await settingsRepo.get(tenantId);
    res.json({ success: true, data: publicSettings(data) });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/settings", authMiddleware, requireRole("Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    validateSettings(req.body);
    await Database.getInstance().runTransaction(tenantId,async()=>{
      const current:any=await settingsRepo.get(tenantId);
      if(current?.version && req.body.version!==current.version) throw Object.assign(new Error("Settings changed on another device. Reload before saving."),{status:409});
      await settingsRepo.save(tenantId, {...current,...req.body});
    });
    res.json({ success: true, message: "Settings saved successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Backward compatibility wrapper route: bulk loads everything via the separate tables
router.get("/privacy/export",authMiddleware,requireRole("Owner"),async(req,res)=>{
  try {
    const tenantId=(req as any).tenantId;
    const state=publicState(await syncService.getFullState(tenantId),"Owner");
    const [items,payments,movements]=await Promise.all([orderItemRepo.getAll(tenantId),paymentRepo.getAll(tenantId),inventoryMovementRepo.getAll(tenantId)]);
    const tenant=(await getGlobalTenantsList()).find(t=>t.tenantId===tenantId);
    res.json({success:true,data:{exportedAt:new Date().toISOString(),tenant:publicTenant(tenant),...state,orderItems:items,payments,inventoryMovements:movements}});
  } catch(error) {handleApiError(res,error);}
});

router.get("/sync", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await syncService.getFullState(tenantId);
    res.json({
      success: true,
      initialized: data !== null,
      data: publicState(data, (req as any).session?.role,(req as any).session?.permissions,(req as any).session?.userId)
    });
  } catch (error: any) {
    console.error(`Sync GET error for tenant ${tenantId}:`, error);
    handleApiError(res, error);
  }
});

// Backward compatibility wrapper route: bulk saves everything via separate tables
router.post("/sync", authMiddleware, requireRole("Owner", "Manager"), idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    if ((req as any).session.role === "Manager" && (req.body.staffList || req.body.settings)) {
      return res.status(403).json({ success: false, error: "FORBIDDEN" });
    }
    if ((req as any).session.role === "Manager" && req.body.recipes && (await settingsRepo.get(tenantId))?.managerCanEditRecipes === false) return res.status(403).json({success:false,error:"FORBIDDEN"});
    if (req.body.orders || req.body.purchases) {
      return res.status(400).json({ success: false, error: "BUSINESS_COMMAND_REQUIRED", message: "Orders and purchases must use their command endpoints." });
    }
    const data = await syncService.saveFullState(tenantId, req.body,(req as any).session.userId);
    res.json({
      success: true,
      initialized: true,
      data: publicState(data, (req as any).session?.role,(req as any).session?.permissions,(req as any).session?.userId)
    });
  } catch (error: any) {
    console.error(`Sync POST error for tenant ${tenantId}:`, error);
    handleApiError(res, error);
  }
});

// Realtime configuration: Anon key access for sensitive database events has been retired
// in favor of server-mediated WebSockets (/ws) with strict tenant claim verification.
router.get("/supabase-config", authMiddleware, (req, res) => {
  res.json({
    success: true,
    serverMediatedRealtime: true,
    wsPath: "/ws"
  });
});

// Report generation & retrieval endpoints (Tenant Scoped & Protected)
router.get("/reports", authMiddleware, requirePermission("reports"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const orders = (await orderRepo.getAll(tenantId)) || [];
    const ingredients = (await ingredientRepo.getAll(tenantId)) || [];
    const shifts = (await shiftRepo.getAll(tenantId)) || [];

    const completedOrders = orders.filter((o) => o.status === "Completed" && Boolean(o.paidAt));
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const cashRevenue = completedOrders.filter((o) => o.paymentMethod === "Cash").reduce((sum, o) => sum + o.total, 0);
    const upiRevenue = completedOrders.filter((o) => o.paymentMethod === "UPI").reduce((sum, o) => sum + o.total, 0);

    res.json({
      success: true,
      tenantId,
      report: {
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        totalRevenue,
        cashRevenue,
        upiRevenue,
        ingredientCount: ingredients.length,
        lowStockCount: ingredients.filter((i) => i.currentStock <= i.minStock).length,
        activeStaffCount: shifts.filter((s) => s.status === "Active").length
      }
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/reports/generate", authMiddleware, requirePermission("reports"), async (req, res) => {
  const { salesData, inventoryData, shiftsData, language } = req.body;
  try {
    const result = await runAiReport((req as any).tenantId,()=>reportService.generateReport(salesData, inventoryData, shiftsData, language || "hindi"));
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("Report generation endpoint error:", error);
    handleApiError(res,error);
  }
});

// Interactive AI Copilot Chat endpoint (Accessible to authenticated app staff & public website visitors)
router.post("/copilot-chat", async (req, res) => {
  const { prompt, history, tenantId, tenantName, staffName, staffRole } = req.body;
  const effectiveTenantId = (req as any).tenantId || tenantId;
  if (!effectiveTenantId) {
    return res.status(400).json({ success: false, error: "MISSING_TENANT", message: "Tenant identifier is required for Copilot." });
  }
  try {
    const result = await copilotService.handleChat(
      prompt,
      history,
      effectiveTenantId,
      tenantName || "Aatmyam POS Website Visitor",
      staffName || "Guest User",
      staffRole || "Visitor"
    );
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("Copilot chat endpoint error:", error);
    handleApiError(res,error);
  }
});

// Background Jobs System Endpoints (Administrative: Only Owner/Manager can inspect, Owner can mutate)
router.get("/jobs", authMiddleware, requireRole("SaaS Owner"), (req, res) => {
  try {
    res.json({
      success: true,
      jobs: jobsService.getJobs(),
      logs: jobsService.getLogs()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/jobs/trigger", authMiddleware, requireRole("SaaS Owner"), async (req, res) => {
  const { jobId } = req.body;
  try {
    const triggered = await jobsService.runJob(jobId);
    res.json({
      success: triggered,
      message: triggered ? "Job triggered successfully" : "Job is already running or invalid jobId"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/jobs/toggle", authMiddleware, requireRole("SaaS Owner"), (req, res) => {
  const { jobId, enabled } = req.body;
  try {
    const success = jobsService.toggleJobEnabled(jobId, enabled);
    res.json({
      success,
      message: success ? "Job toggle updated" : "Job not found"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/jobs/clear-logs", authMiddleware, requireRole("SaaS Owner"), (req, res) => {
  try {
    jobsService.clearLogs();
    res.json({ success: true, message: "Job logs cleared successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Alert configuration has its own version and explicit save; never rides settings autosave.
router.get('/notification-settings',authMiddleware,requireRole('Owner'),async(req,res)=>{try{res.json({success:true,data:await operationalAlerts.rules((req as any).tenantId)});}catch(error){handleApiError(res,error);}});
router.put('/notification-settings',authMiddleware,requireRole('Owner'),async(req,res)=>{try{res.json({success:true,data:await operationalAlerts.saveRules((req as any).tenantId,req.body)});}catch(error){handleApiError(res,error);}});

// Central Notification System Endpoints
router.get("/notifications", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Tenant not resolved from session." });
  }
  try {
    const inApp = await notificationService.getInbox(tenantId,(req as any).session);
    const logs = (req as any).session.role==='Owner' ? await notificationService.getDispatchLogs(tenantId) : [];
    res.json({
      success: true,
      notifications: inApp,
      dispatchLogs: logs
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/notifications/send", authMiddleware, requireRole("Owner", "Manager"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Tenant not resolved from session." });
  }
  const { title, message, severity, channels, recipientEmail, recipientPhone, metadata } = req.body;
  try {
    const result = await notificationService.send(tenantId, {
      title,
      message,
      severity: severity || "info",
      channels: channels || ["in-app"],
      recipientEmail,
      recipientPhone,
      metadata
    });
    res.json({
      success: true,
      details: result.dispatchedChannels
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/notifications/read", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { id } = req.body;
  try {
    const success = await notificationService.updateInbox(tenantId,(req as any).session,'read',id);
    res.json({ success, message: success ? "Notification marked as read" : "Notification not found" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/notifications/read-all", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await notificationService.updateInbox(tenantId,(req as any).session,'read-all');
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/notifications", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { id } = req.body;
  try {
    const success = await notificationService.updateInbox(tenantId,(req as any).session,'dismiss',id);
    res.json({ success, message: success ? "Notification deleted" : "Notification not found" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/notifications/clear-logs", authMiddleware, requireRole("Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await notificationService.clearDispatchLogs(tenantId);
    res.json({ success: true, message: "Dispatch history logs cleared" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Central Event-Driven Architecture Endpoints (Owner & Manager authorized, strictly tenant-scoped)
router.get("/events", authMiddleware, requireRole("Owner","Manager"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Tenant not resolved from session." });
  }
  try {
    const history = eventBus.getHistory(tenantId);
    const logs = await auditLogService.getLogs(tenantId);
    const db = Database.getInstance();
    const analytics = await db.getObject(tenantId, "system_event_analytics") || {
      totalEventsProcessed: 0,
      totalOrdersCompleted: 0,
      totalPaymentsProcessed: 0,
      totalRevenue: 0,
      inventoryAdjustments: 0,
      lastUpdated: new Date().toISOString()
    };
    res.json({
      success: true,
      history,
      auditLogs: logs,
      analytics
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/events/publish", authMiddleware, requireRole("SaaS Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Tenant not resolved from session." });
  }
  const { type, payload } = req.body;
  try {
    eventBus.publish(tenantId, type, payload);
    res.json({ success: true, message: `Event ${type} published successfully.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/events/clear", authMiddleware, requireRole("SaaS Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Tenant not resolved from session." });
  }
  try {
    eventBus.clearHistory(tenantId);
    try {
      await auditLogService.clearLogs(tenantId);
    } catch (auditErr: any) {
      console.warn("Audit logs are protected and immutable:", auditErr.message);
    }
    const db = Database.getInstance();
    await db.saveObject(tenantId, "system_event_analytics", {
      totalEventsProcessed: 0,
      totalOrdersCompleted: 0,
      totalPaymentsProcessed: 0,
      totalRevenue: 0,
      inventoryAdjustments: 0,
      lastUpdated: new Date().toISOString()
    });
    res.json({ success: true, message: "System events cleared. Note: Audit log records are cryptographically signed and remain immutable." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Real-Time Logging & Monitoring Dashboard API Endpoints (Owner-only operations)
router.post("/monitoring/report-error", authMiddleware, async (req, res) => {
  const { message, stack, level, component, tenantId, userId, url, userAgent } = req.body;
  try {
    await monitoringService.log(
      (level || "ERROR") as any,
      "CLIENT_FRONTEND_CRASH",
      `Frontend Boundary Error: ${message || "Unknown error"}`,
      {
        component: component || "UnknownComponent",
        stack: stack || "No stack trace",
        tenantId: (req as any).tenantId,
        userId: (req as any).session.userId,
        url: url || "Unknown URL",
        userAgent: userAgent || "Unknown Agent"
      }
    );
    res.json({ success: true, message: "Client crash report dispatched to centralized central logger." });
  } catch (error: any) {
    console.error("Failed to register client crash report:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/monitoring/telemetry", authMiddleware, requireRole("SaaS Owner"), async (req, res) => {
  try {
    const logs = await monitoringService.getLogs();
    const metrics = await monitoringService.getMetrics();
    res.json({
      success: true,
      logs,
      metrics
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/monitoring/clear", authMiddleware, requireRole("SaaS Owner"), async (req, res) => {
  try {
    await monitoringService.clearLogs();
    await monitoringService.info("SYSTEM", "Centralized telemetry logs cleared by administrator.");
    res.json({ success: true, message: "Telemetry logs successfully wiped." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/monitoring/redis-status", authMiddleware, requireRole("SaaS Owner"), async (req, res) => {
  try {
    const active = redisCacheService.isActive();
    const redisHost = process.env.REDIS_HOST || "127.0.0.1";
    const redisPort = process.env.REDIS_PORT || "6379";
    res.json({
      success: true,
      active,
      config: {
        host: redisHost,
        port: redisPort,
        hasUrl: !!process.env.REDIS_URL,
        hasPassword: !!process.env.REDIS_PASSWORD
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/monitoring/redis-flush", authMiddleware, requireRole("SaaS Owner"), async (req, res) => {
  try {
    await redisCacheService.clearAll();
    await monitoringService.info("SYSTEM", "Administrator flushed all Redis cache databases manually.");
    res.json({ success: true, message: "Redis cache memory flushed successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/monitoring/backups", authMiddleware, requireRole("SaaS Owner"), (_req, res) => {
  res.json({ success: true, backups: [], pitrEnabled: null, providerManaged: true,
    message: "Manage and verify database backups in your database provider dashboard." });
});
for (const path of ["/monitoring/backups/trigger", "/monitoring/backups/toggle-pitr", "/monitoring/test-alert"]) {
  router.post(path, authMiddleware, requireRole("SaaS Owner"), (_req, res) => {
    res.status(501).json({ success: false, error: "NOT_CONFIGURED", message: "Configure this operation in the hosting provider dashboard." });
  });
}

router.post("/monitoring/simulate", authMiddleware, requireRole("SaaS Owner"), async (req, res) => {
  const { type } = req.body;
  try {
    switch (type) {
      case "error_exception":
        await monitoringService.error("BILLING_ENGINE", "CRITICAL: Credit card gateway timed out.", {
          errorCode: "GW_TIMEOUT_504",
          gateway: "Stripe Connect",
          retryCount: 3,
          transactionId: "txn_simulate_88329"
        });
        break;
      case "warn_inventory":
        await monitoringService.warn("INVENTORY", "Item quantity low: 'Vegan Avocado Patty' is below safety threshold (5 units left).", {
          sku: "ING-AVO-092",
          currentStock: 4,
          reorderPoint: 15
        });
        break;
      case "db_slow_query":
        await monitoringService.log(
          "WARN",
          "DATABASE",
          "Slow SQL query detected: SELECT * FROM billing_transactions WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC",
          {
            rowsReturned: 4500,
            indexScanned: "idx_transactions_tenant",
            parameters: ["veg-main-001", "success"]
          },
          850 // 850ms duration
        );
        break;
      case "info_event":
        await monitoringService.info("SYNC_SERVICE", "Multi-tenant sync cycle completed. 14 database tables verified successfully.", {
          durationMs: 142,
          tablesProcessed: ["menu", "ingredients", "recipes", "orders", "customers", "shifts"]
        });
        break;
      case "metric_report":
        await monitoringService.log(
          "METRIC",
          "REPORT_ENGINE",
          "Generated AI sales trend report forecasting vegan burger popularity peaks.",
          {
            reportId: "rep-sales-09",
            tokensConsumed: 1420,
            computeCostUsd: 0.0284
          },
          1250
        );
        break;
      default:
        await monitoringService.info("SYSTEM", "Generic test monitoring probe triggered.");
    }
    res.json({ success: true, message: `Simulated event of type '${type}' registered.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
