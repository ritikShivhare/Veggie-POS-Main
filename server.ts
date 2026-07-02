import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Import Repositories
import { MenuRepository } from "./server/features/pos/MenuRepository";
import { IngredientRepository } from "./server/features/inventory/IngredientRepository";
import { RecipeRepository } from "./server/features/inventory/RecipeRepository";
import { StaffRepository } from "./server/features/staff/StaffRepository";
import { OrderRepository } from "./server/features/pos/OrderRepository";
import { CustomerRepository } from "./server/features/crm/CustomerRepository";
import { PurchaseRepository } from "./server/features/inventory/PurchaseRepository";
import { ShiftRepository } from "./server/features/staff/ShiftRepository";
import { SettingsRepository } from "./server/features/shared/SettingsRepository";

// Import Services
import { SyncService } from "./server/features/shared/SyncService";
import { ReportService } from "./server/features/reports/ReportService";
import { CopilotService } from "./server/features/copilot/CopilotService";
import { BackgroundJobsService } from "./server/features/jobs/BackgroundJobsService";
import { NotificationService } from "./server/features/notifications/NotificationService";
import { EventBus } from "./server/features/shared/EventBus";
import { initializeEventSubscribers } from "./server/features/shared/EventBusSetup";
import { AuditLogService } from "./server/features/shared/AuditLogService";
import { Database } from "./server/features/shared/database";
import { SessionService } from "./server/features/auth/SessionService";
import { MonitoringService } from "./server/features/shared/MonitoringService";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Request performance & event telemetry middleware
const monitoringService = MonitoringService.getInstance();
app.use((req, res, next) => {
  if (req.path.startsWith("/api/monitoring") || req.path.startsWith("/@vite") || req.path.startsWith("/src")) {
    return next();
  }

  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
    
    monitoringService.log(
      level,
      "API_GATEWAY",
      `${req.method} ${req.path} - HTTP ${status}`,
      {
        method: req.method,
        path: req.path,
        status,
        ip: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
        query: req.query
      },
      duration
    );
  });

  next();
});

// Instantiate Repositories
const menuRepo = new MenuRepository();
const ingredientRepo = new IngredientRepository();
const recipeRepo = new RecipeRepository();
const staffRepo = new StaffRepository();
const orderRepo = new OrderRepository();
const customerRepo = new CustomerRepository();
const purchaseRepo = new PurchaseRepository();
const shiftRepo = new ShiftRepository();
const settingsRepo = new SettingsRepository();

// Instantiate Services and inject Repositories
const syncService = new SyncService(
  menuRepo,
  ingredientRepo,
  recipeRepo,
  staffRepo,
  orderRepo,
  customerRepo,
  purchaseRepo,
  shiftRepo,
  settingsRepo
);
const reportService = new ReportService();
const copilotService = new CopilotService();

// API health route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Sync endpoint: Get tenant state
app.get("/api/sync", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "veg-main-001";
  try {
    const data = await syncService.getFullState(tenantId);
    res.json({
      success: true,
      initialized: data !== null,
      data: data
    });
  } catch (error: any) {
    console.error(`Sync GET error for tenant ${tenantId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync endpoint: Save tenant state
app.post("/api/sync", async (req, res) => {
  const tenantId = (req.query.tenantId as string) || "veg-main-001";
  try {
    const data = await syncService.saveFullState(tenantId, req.body);
    res.json({
      success: true,
      initialized: true,
      data: data
    });
  } catch (error: any) {
    console.error(`Sync POST error for tenant ${tenantId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Report generation endpoint
app.post("/api/reports/generate", async (req, res) => {
  const { salesData, inventoryData, shiftsData } = req.body;
  try {
    const result = await reportService.generateReport(salesData, inventoryData, shiftsData);
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("Report generation endpoint error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Interactive AI Copilot Chat endpoint
app.post("/api/copilot-chat", async (req, res) => {
  const { prompt, history, tenantId, tenantName, staffName, staffRole } = req.body;
  try {
    const result = await copilotService.handleChat(
      prompt,
      history,
      tenantId,
      tenantName,
      staffName,
      staffRole
    );
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("Copilot chat endpoint error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Background Jobs System Endpoints
const jobsService = BackgroundJobsService.getInstance();

app.get("/api/jobs", (req, res) => {
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

app.post("/api/jobs/trigger", async (req, res) => {
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

app.post("/api/jobs/toggle", (req, res) => {
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

app.post("/api/jobs/clear-logs", (req, res) => {
  try {
    jobsService.clearLogs();
    res.json({ success: true, message: "Job logs cleared successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Central Notification System Endpoints
const notificationService = NotificationService.getInstance();
const DEFAULT_TENANT_ID = "veg-main-001";

app.get("/api/notifications", async (req, res) => {
  try {
    const inApp = await notificationService.getInAppNotifications(DEFAULT_TENANT_ID);
    const logs = await notificationService.getDispatchLogs(DEFAULT_TENANT_ID);
    res.json({
      success: true,
      notifications: inApp,
      dispatchLogs: logs
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/notifications/send", async (req, res) => {
  const { title, message, severity, channels, recipientEmail, recipientPhone, metadata } = req.body;
  try {
    const result = await notificationService.send(DEFAULT_TENANT_ID, {
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

app.post("/api/notifications/read", async (req, res) => {
  const { id } = req.body;
  try {
    const success = await notificationService.markAsRead(DEFAULT_TENANT_ID, id);
    res.json({ success, message: success ? "Notification marked as read" : "Notification not found" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/notifications/read-all", async (req, res) => {
  try {
    await notificationService.markAllAsRead(DEFAULT_TENANT_ID);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/notifications", async (req, res) => {
  const { id } = req.body;
  try {
    const success = await notificationService.deleteNotification(DEFAULT_TENANT_ID, id);
    res.json({ success, message: success ? "Notification deleted" : "Notification not found" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/notifications/clear-logs", async (req, res) => {
  try {
    await notificationService.clearDispatchLogs(DEFAULT_TENANT_ID);
    res.json({ success: true, message: "Dispatch history logs cleared" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Central Event-Driven Architecture Endpoints
const eventBus = EventBus.getInstance();
const auditLogService = AuditLogService.getInstance();

app.get("/api/events", async (req, res) => {
  try {
    const history = eventBus.getHistory();
    const logs = await auditLogService.getLogs(DEFAULT_TENANT_ID);
    const db = Database.getInstance();
    const analytics = await db.getObject(DEFAULT_TENANT_ID, "system_event_analytics") || {
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

app.post("/api/events/publish", async (req, res) => {
  const { type, payload } = req.body;
  try {
    eventBus.publish(DEFAULT_TENANT_ID, type, payload);
    res.json({ success: true, message: `Event ${type} published successfully.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/events/clear", async (req, res) => {
  try {
    eventBus.clearHistory();
    await auditLogService.clearLogs(DEFAULT_TENANT_ID);
    const db = Database.getInstance();
    await db.saveObject(DEFAULT_TENANT_ID, "system_event_analytics", {
      totalEventsProcessed: 0,
      totalOrdersCompleted: 0,
      totalPaymentsProcessed: 0,
      totalRevenue: 0,
      inventoryAdjustments: 0,
      lastUpdated: new Date().toISOString()
    });
    res.json({ success: true, message: "All events, analytics, and audit logs have been successfully cleared." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Production-Level Session and Lockout Management Endpoints
const sessionService = SessionService.getInstance();

app.post("/api/auth/login", async (req, res) => {
  const { pin, email, tenantId = DEFAULT_TENANT_ID } = req.body;
  const userAgent = req.headers["user-agent"] || "Unknown User Agent";
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const ip = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

  try {
    const staff = (await staffRepo.getAll(tenantId)) || [];
    let matchingUser = staff.find((s) => s.pin === pin);
    
    const userId = matchingUser ? matchingUser.id : "unknown";
    const userName = matchingUser ? matchingUser.name : (email ? email.split('@')[0] : "Unknown User");
    const role = matchingUser ? matchingUser.role : "Staff";

    const lockout = await sessionService.checkLockout(tenantId, userId, ip);
    if (lockout.locked) {
      return res.status(423).json({
        success: false,
        error: "ACCOUNT_LOCKED",
        message: `Too many failed login attempts. Access is locked out until ${new Date(lockout.lockedUntil!).toLocaleTimeString()}.`,
        lockedUntil: lockout.lockedUntil
      });
    }

    if (!matchingUser) {
      const failStatus = await sessionService.registerFailedLogin(
        tenantId,
        userId,
        userName,
        role,
        ip,
        userAgent,
        "Incorrect PIN code entered"
      );
      
      return res.status(401).json({
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Incorrect passcode PIN code. Please try again.",
        remainingAttempts: failStatus.remainingAttempts,
        locked: failStatus.locked,
        lockedUntil: failStatus.lockedUntil
      });
    }

    const session = await sessionService.createSession(
      tenantId,
      matchingUser.id,
      matchingUser.name,
      matchingUser.role,
      ip,
      userAgent
    );

    res.json({
      success: true,
      session,
      user: {
        id: matchingUser.id,
        name: matchingUser.name,
        role: matchingUser.role,
        permissions: matchingUser.permissions
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/validate", async (req, res) => {
  const { sessionId, tenantId = DEFAULT_TENANT_ID } = req.body;
  try {
    const session = await sessionService.validateAndTouchSession(tenantId, sessionId);
    if (!session) {
      return res.json({ success: false, error: "SESSION_EXPIRED", message: "Session is inactive or has expired due to idle timeout." });
    }
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const { sessionId, tenantId = DEFAULT_TENANT_ID } = req.body;
  try {
    const success = await sessionService.revokeSession(tenantId, sessionId);
    res.json({ success, message: "Logged out successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/auth/sessions-data", async (req, res) => {
  const { tenantId = DEFAULT_TENANT_ID } = req.query;
  const tid = String(tenantId);
  try {
    const activeSessions = await sessionService.getActiveSessions(tid);
    const loginHistory = await sessionService.getLoginHistory(tid);
    const securitySettings = await sessionService.getSecuritySettings(tid);
    res.json({
      success: true,
      activeSessions,
      loginHistory,
      securitySettings
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/sessions/revoke", async (req, res) => {
  const { sessionId, tenantId = DEFAULT_TENANT_ID } = req.body;
  try {
    const success = await sessionService.revokeSession(tenantId, sessionId);
    res.json({ success: true, message: `Session revoked successfully.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/sessions/revoke-all", async (req, res) => {
  const { tenantId = DEFAULT_TENANT_ID, exceptSessionId } = req.body;
  try {
    if (exceptSessionId) {
      const active = await sessionService.getActiveSessions(tenantId);
      const remaining = active.filter(s => s.sessionId === exceptSessionId);
      const db = Database.getInstance();
      await db.saveObject(tenantId, "system_active_sessions", remaining);
    } else {
      await sessionService.revokeAllSessions(tenantId);
    }
    res.json({ success: true, message: "All other active sessions have been terminated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/history/clear", async (req, res) => {
  const { tenantId = DEFAULT_TENANT_ID } = req.body;
  try {
    await sessionService.clearLoginHistory(tenantId);
    res.json({ success: true, message: "Login history successfully wiped." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/settings/update", async (req, res) => {
  const { tenantId = DEFAULT_TENANT_ID, sessionTimeoutMinutes, maxFailedAttempts, lockoutDurationSeconds, enableBruteForceProtection } = req.body;
  try {
    const settings = {
      sessionTimeoutMinutes: Number(sessionTimeoutMinutes) || 15,
      maxFailedAttempts: Number(maxFailedAttempts) || 3,
      lockoutDurationSeconds: Number(lockoutDurationSeconds) || 60,
      enableBruteForceProtection: enableBruteForceProtection !== undefined ? Boolean(enableBruteForceProtection) : true
    };
    await sessionService.saveSecuritySettings(tenantId, settings);
    res.json({ success: true, message: "Security parameters successfully updated.", settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Real-Time Logging & Monitoring Dashboard API Endpoints
app.get("/api/monitoring/telemetry", async (req, res) => {
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

app.post("/api/monitoring/clear", async (req, res) => {
  try {
    await monitoringService.clearLogs();
    await monitoringService.info("SYSTEM", "Centralized telemetry logs cleared by administrator.");
    res.json({ success: true, message: "Telemetry logs successfully wiped." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/monitoring/simulate", async (req, res) => {
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

async function startServer() {

  // Initialize and register all EventBus subscribers (loose coupling)
  initializeEventSubscribers();

  // Start the background jobs scheduler
  await jobsService.startScheduler();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

