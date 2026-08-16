import express from "express";
import crypto from "crypto";
import { MenuRepository } from "./features/pos/MenuRepository";
import { IngredientRepository } from "./features/inventory/IngredientRepository";
import { RecipeRepository } from "./features/inventory/RecipeRepository";
import { StaffRepository } from "./features/staff/StaffRepository";
import { OrderRepository } from "./features/pos/OrderRepository";
import { CustomerRepository } from "./features/crm/CustomerRepository";
import { PurchaseRepository } from "./features/inventory/PurchaseRepository";
import { ShiftRepository } from "./features/staff/ShiftRepository";
import { SettingsRepository } from "./features/shared/SettingsRepository";

// Import Services
import { SyncService } from "./features/shared/SyncService";
import { ReportService } from "./features/reports/ReportService";
import { CopilotService } from "./features/copilot/CopilotService";
import { BackgroundJobsService } from "./features/jobs/BackgroundJobsService";
import { NotificationService } from "./features/notifications/NotificationService";
import { EventBus } from "./features/shared/EventBus";
import { AuditLogService } from "./features/shared/AuditLogService";
import { Database } from "./features/shared/database";
import { SessionService } from "./features/auth/SessionService";
import { MonitoringService } from "./features/shared/MonitoringService";
import { getSubscription, saveSubscription, PLAN_LIMITS } from "./features/shared/subscription";
export { getSubscription, saveSubscription, PLAN_LIMITS };

// Instantiate Repositories
export const menuRepo = new MenuRepository();
export const ingredientRepo = new IngredientRepository();
export const recipeRepo = new RecipeRepository();
export const staffRepo = new StaffRepository();
export const orderRepo = new OrderRepository();
export const customerRepo = new CustomerRepository();
export const purchaseRepo = new PurchaseRepository();
export const shiftRepo = new ShiftRepository();
export const settingsRepo = new SettingsRepository();

// Instantiate Services and inject Repositories
export const syncService = new SyncService(
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
export const reportService = new ReportService();
export const copilotService = new CopilotService();
export const sessionService = SessionService.getInstance();
export const monitoringService = MonitoringService.getInstance();
export const jobsService = BackgroundJobsService.getInstance();
export const notificationService = NotificationService.getInstance();
export const eventBus = EventBus.getInstance();
export const auditLogService = AuditLogService.getInstance();

export const DEFAULT_TENANT_ID = "veg-main-001";

// Global Tenants Registry for SaaS Management
export const suspendedTenants = new Set<string>();

export async function getGlobalTenantsList(): Promise<any[]> {
  const db = Database.getInstance();
  let list = await db.getObject<any[]>("veg-main-001", "global_tenants_list");
  if (!list) {
    list = [
      {
        id: "t-1",
        name: "Main Veggie Bistro",
        tenantId: "veg-main-001",
        status: "active",
        created: "2026-01-15",
        region: "North India / Delhi",
        ownerName: "Rahul Sharma",
        email: "rahul@veggiebistro.com",
        ownerPhone: "9876543210"
      },
      {
        id: "t-2",
        name: "Connaught Place Express",
        tenantId: "veg-cp-002",
        status: "active",
        created: "2026-03-22",
        region: "North India / Delhi",
        ownerName: "Amit Verma",
        email: "amit@veggiebistro.com",
        ownerPhone: "9123456789"
      },
      {
        id: "t-3",
        name: "Reetesh Dhaba",
        tenantId: "veg-reetesh-dhaba",
        status: "active",
        created: "2026-07-04",
        region: "North India / Delhi",
        ownerName: "Reetesh",
        email: "reetesh@dhaba.com",
        ownerPhone: "9999911111"
      }
    ];
    await db.saveObject("veg-main-001", "global_tenants_list", list);
  }
  return list;
}

export async function saveGlobalTenantsList(list: any[]): Promise<void> {
  const db = Database.getInstance();
  await db.saveObject("veg-main-001", "global_tenants_list", list);
  
  // Keep the in-memory suspended list synchronized
  suspendedTenants.clear();
  for (const t of list) {
    if (t.status === "suspended") {
      suspendedTenants.add(t.tenantId);
    }
  }
}

// Initial pull of suspended tenants
getGlobalTenantsList().then((list) => {
  for (const t of list) {
    if (t.status === "suspended") {
      suspendedTenants.add(t.tenantId);
    }
  }
}).catch((err) => {
  console.error("Failed to pre-load suspended tenants:", err);
});

// Authentication & Tenant Validation Middleware
export const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const isAuthRoute = req.path.startsWith("/api/auth/login") || 
                      req.path.startsWith("/api/auth/validate") || 
                      req.path.startsWith("/api/auth/logout") ||
                      req.path.startsWith("/api/auth/staff-directory") ||
                      req.path.startsWith("/api/auth/signup") ||
                      req.path.startsWith("/api/auth/verify") ||
                      req.path.startsWith("/api/saas-admin/login") ||
                      req.path.startsWith("/api/health") ||
                      req.path.startsWith("/api/copilot-chat") ||
                      req.path.startsWith("/api/webhooks");

  if (isAuthRoute) {
    const clientTenantId = (req.headers["x-tenant-id"] as string) || (req.query.tenantId as string) || (req.body.tenantId as string) || "veg-main-001";
    (req as any).tenantId = clientTenantId;
    return next();
  }

  const sessionId = (req.headers["x-session-id"] as string) || (req.query.sessionId as string) || (req.body.sessionId as string);

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "A valid active security session is required to access this resource."
    });
  }

  // Resolve the tenantId in O(1) using our direct sessionId-to-tenantId index
  let session: any = null;
  const resolvedTenantId = await sessionService.resolveTenantId(sessionId, getGlobalTenantsList);

  if (resolvedTenantId) {
    session = await sessionService.validateAndTouchSession(resolvedTenantId, sessionId);
  }

  if (!session) {
    return res.status(401).json({
      success: false,
      error: "SESSION_EXPIRED",
      message: "Your session has expired or has been revoked."
    });
  }

  // Tenant ID is exclusively resolved from the validated session!
  const tenantId = session.tenantId;
  (req as any).tenantId = tenantId;
  (req as any).session = session;

  // 403 Forbidden check for suspended tenants
  if (suspendedTenants.has(tenantId)) {
    return res.status(403).json({
      success: false,
      error: "SUSPENDED_TENANT",
      message: "This tenant workspace has been suspended by the SaaS administrator. Please contact support."
    });
  }

  // Load subscription to enforce read-only restrictions
  const sub = await getSubscription(tenantId);
  (req as any).subscription = sub;

  const isMutation = ["POST", "PUT", "DELETE"].includes(req.method);
  if (sub.isReadOnly && isMutation) {
    return res.status(403).json({
      success: false,
      error: "READ_ONLY_MODE",
      message: "This account is currently in Read-Only mode due to an unpaid, past-due, or canceled subscription. Please update your payment details or subscribe in the Rules Settings panel to restore full write access."
    });
  }

  next();
};

// SaaS Super-Admin Management Middleware
export const adminAuthMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const sessionId = (req.headers["x-session-id"] as string) || (req.query.sessionId as string) || (req.body.sessionId as string);
  
  if (!sessionId) {
    return res.status(401).json({ success: false, error: "UNAUTHORIZED", message: "Super-Admin session ID required." });
  }

  try {
    const session = await sessionService.validateAndTouchSession("saas-admin", sessionId);
    if (!session || session.role !== "SaaS Owner") {
      return res.status(403).json({ success: false, error: "FORBIDDEN", message: "Only SaaS Owner can access these super-admin methods." });
    }
    (req as any).session = session;
    next();
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// TOTP Helpers
export function base32tohex(base32: string): string {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let hex = "";
  const cleanedBase32 = base32.replace(/=+$/, "").replace(/\s+/g, "");
  for (let i = 0; i < cleanedBase32.length; i++) {
    const val = base32chars.indexOf(cleanedBase32.charAt(i).toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substring(i, i + 4);
    hex = hex + parseInt(chunk, 2).toString(16);
  }
  return hex;
}

export function verifyTOTP(token: string, secret: string, window = 1): boolean {
  try {
    const cleanToken = token.replace(/\s+/g, "");
    if (cleanToken.length !== 6) return false;

    const hexSecret = base32tohex(secret);
    const key = Buffer.from(hexSecret, "hex");
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);

    for (let i = -window; i <= window; i++) {
      const c = counter + i;
      const buffer = Buffer.alloc(8);
      buffer.writeUInt32BE(0, 0);
      buffer.writeUInt32BE(c, 4);

      const hmac = crypto.createHmac("sha1", key);
      hmac.update(buffer);
      const hmacResult = hmac.digest();

      const offset = hmacResult[hmacResult.length - 1] & 0xf;
      const code =
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff);

      const otp = (code % 1000000).toString().padStart(6, "0");
      if (otp === cleanToken) {
        return true;
      }
    }
  } catch (err) {
    console.error("verifyTOTP error:", err);
  }
  return false;
}

export function generateTOTP(secret: string): string {
  try {
    const hexSecret = base32tohex(secret);
    const key = Buffer.from(hexSecret, "hex");
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);

    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(0, 0);
    buffer.writeUInt32BE(counter, 4);

    const hmac = crypto.createHmac("sha1", key);
    hmac.update(buffer);
    const hmacResult = hmac.digest();

    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, "0");
  } catch (err) {
    console.error("generateTOTP error:", err);
    return "000000";
  }
}
