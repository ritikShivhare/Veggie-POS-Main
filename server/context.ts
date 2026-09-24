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
import { SessionService, SESSION_COOKIE_NAME } from "./features/auth/SessionService";
import { MonitoringService } from "./features/shared/MonitoringService";
import { IdempotencyService } from "./features/shared/IdempotencyService";
import { idempotencyMiddleware } from "./middleware/idempotency.middleware";
import { realtimeService, RealtimeService } from "./features/shared/RealtimeService";
import { getSubscription, saveSubscription, PLAN_LIMITS } from "./features/shared/subscription";
export { getSubscription, saveSubscription, PLAN_LIMITS, realtimeService, RealtimeService };

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
export const idempotencyService = IdempotencyService.getInstance();
export { idempotencyMiddleware };

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

// Strict Allowlist of Public Routes (Method + Path)
// Only these endpoints can be accessed without a valid active session.
// Client-sent tenantId is NEVER treated as authority on any route.
export const PUBLIC_ROUTES = [
  { method: "GET", path: "/api/health" },
  { method: "POST", path: "/api/auth/login" },
  { method: "POST", path: "/api/auth/signup" },
  { method: "POST", path: "/api/auth/verify" },
  { method: "GET", path: "/api/auth/lockout-status" },
  { method: "POST", path: "/api/auth/unlock-override" },
  { method: "POST", path: "/api/auth/validate" },
  { method: "POST", path: "/api/auth/logout" },
  { method: "GET", path: "/api/auth/tenant-info" },
  { method: "GET", path: "/api/auth/staff-directory" },
  { method: "POST", path: "/api/saas-admin/login" },
  { method: "POST", path: "/api/webhooks/stripe" },
  { method: "POST", path: "/api/monitoring/report-error" },
  { method: "POST", path: "/api/copilot-chat" },
  { method: "GET", path: "/api/billing/mock-checkout" },
  { method: "POST", path: "/api/billing/mock-payment-success" },
  { method: "POST", path: "/api/billing/mock-payment-fail" },
  { method: "GET", path: "/api/billing/mock-portal" }
];

export function isPublicRoute(req: express.Request): boolean {
  const reqMethod = (req.method || "GET").toUpperCase();
  let reqPath = (req.originalUrl || req.path || "").split("?")[0];
  if (!reqPath.startsWith("/api/")) {
    if (reqPath.startsWith("/")) {
      reqPath = "/api" + reqPath;
    } else {
      reqPath = "/api/" + reqPath;
    }
  }

  return PUBLIC_ROUTES.some((route) => {
    return route.method === reqMethod && route.path === reqPath;
  });
}

// Authentication & Tenant Isolation Middleware
// Enforces: Tenant is ALWAYS derived from verified session. Client-sent tenantId is never authoritative.
export const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isPublicRoute(req)) {
    // Public routes proceed without setting an authoritative session-derived tenant
    return next();
  }

  const sessionId =
    (req.cookies?.[SESSION_COOKIE_NAME] as string) ||
    (req.headers["x-session-id"] as string) ||
    (typeof req.headers["authorization"] === "string" && req.headers["authorization"].startsWith("Bearer ")
      ? req.headers["authorization"].substring(7).trim()
      : undefined) ||
    (req.query?.sessionId as string) ||
    (req.body?.sessionId as string);

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "A valid active security session is required to access this resource."
    });
  }

  // Resolve the tenantId strictly from session
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

  // Tenant ID is strictly derived from the validated session!
  const tenantId = session.tenantId;
  if (!tenantId) {
    return res.status(403).json({
      success: false,
      error: "MISSING_TENANT",
      message: "Session is not associated with any valid tenant."
    });
  }

  // Anti-Spoofing: Client-sent tenantId cannot override or contradict session tenant
  const clientProvidedTenant =
    (req.headers["x-tenant-id"] as string) ||
    (req.query?.tenantId as string) ||
    (req.body?.tenantId as string);

  if (clientProvidedTenant && clientProvidedTenant !== tenantId) {
    const isSaaSAdmin = session.role === "SaaS Owner" || tenantId === "saas-admin";
    if (!isSaaSAdmin) {
      return res.status(403).json({
        success: false,
        error: "TENANT_MISMATCH",
        message: `Tenant isolation violation: Client-provided tenantId (${clientProvidedTenant}) does not match authenticated session tenant (${tenantId}).`
      });
    }
  }

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
      message: "This account is currently in Read-Only mode due to an unpaid, past-due, or canceled subscription."
    });
  }

  next();
};

/**
 * Centralized Role-Based Access Control (RBAC) Middleware: requireRole
 * Ensures that the authenticated session user has one of the allowed roles.
 * Note: 'Owner' and 'SaaS Owner' inherit top-level administrative authority.
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = (req as any).session;
    if (!session) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Authentication session is required to perform this action."
      });
    }

    const role = session.role;
    const isSuperOrOwner = role === "Owner" || role === "SaaS Owner";
    if (isSuperOrOwner || allowedRoles.includes(role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: "FORBIDDEN",
      message: `Access denied. Action requires one of the following roles: [${allowedRoles.join(", ")}]. Current role: "${role}".`
    });
  };
};

/**
 * Centralized Permission-Based Access Control (PBAC) Middleware: requirePermission
 * Ensures that the authenticated user possesses the required permission(s).
 * Note: 'Owner' and 'SaaS Owner' inherently possess all permissions.
 */
export const requirePermission = (...requiredPermissions: string[]) => {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = (req as any).session;
    if (!session) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Authentication session is required to perform this action."
      });
    }

    const role = session.role;
    if (role === "Owner" || role === "SaaS Owner") {
      return next();
    }

    let userPermissions: string[] = session.permissions || [];

    // Fallback: If permissions not present on session, resolve from staffRepo
    if (!userPermissions || userPermissions.length === 0) {
      try {
        const tenantId = (req as any).tenantId;
        if (tenantId) {
          const staffList = (await staffRepo.getAll(tenantId)) || [];
          const currentStaff = staffList.find(s => s.id === session.userId);
          if (currentStaff && currentStaff.permissions) {
            userPermissions = currentStaff.permissions;
            session.permissions = userPermissions;
          }
        }
      } catch (err) {
        console.error("Error resolving staff permissions for RBAC:", err);
      }
    }

    const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: `Access denied. Action requires permission: [${requiredPermissions.join(", ")}]. Current permissions: [${userPermissions.join(", ")}].`
      });
    }

    return next();
  };
};

// SaaS Super-Admin Management Middleware
export const adminAuthMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const sessionId =
    (req.cookies?.[SESSION_COOKIE_NAME] as string) ||
    (req.headers["x-session-id"] as string) ||
    (typeof req.headers["authorization"] === "string" && req.headers["authorization"].startsWith("Bearer ")
      ? req.headers["authorization"].substring(7).trim()
      : undefined) ||
    (req.query?.sessionId as string) ||
    (req.body?.sessionId as string);
  
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
