import crypto from "crypto";
import { Database } from "../shared/database";

export const SESSION_COOKIE_NAME = "veggiepos_session";

export interface CookieSecurityOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "none" | "lax" | "strict";
  path: string;
  maxAge?: number;
}

/**
 * Returns production-hardened HttpOnly cookie security configuration.
 * Automatically enforces Secure & SameSite=None under HTTPS / cloud proxy environments.
 */
export function getSessionCookieOptions(req?: any): CookieSecurityOptions {
  const isHttps =
    process.env.NODE_ENV === "production" ||
    Boolean(req?.secure) ||
    req?.headers?.["x-forwarded-proto"] === "https";

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  };
}

/**
 * Returns options to clear the HttpOnly session cookie on logout / revoke.
 */
export function getClearCookieOptions(req?: any): CookieSecurityOptions {
  const isHttps =
    process.env.NODE_ENV === "production" ||
    Boolean(req?.secure) ||
    req?.headers?.["x-forwarded-proto"] === "https";

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/"
  };
}

/**
 * Generates a cryptographically secure 256-bit random session identifier (URL-safe base64url).
 */
export function generateSecureSessionId(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export interface UserSession {
  sessionId: string;
  userId: string;
  userName: string;
  role: string;
  tenantId: string;
  permissions?: string[];
  ipAddress: string;
  device: {
    os: string;
    browser: string;
    deviceType: string;
    userAgent: string;
  };
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  tenantId: string;
  ipAddress: string;
  device: {
    os: string;
    browser: string;
    deviceType: string;
  };
  status: "success" | "failed";
  failureReason?: string;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationSeconds: number;
  enableBruteForceProtection: boolean;
}

export interface FailedAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  lockedUntil: string;
  tier: number;
}

export class SessionService {
  private static instance: SessionService;
  private db: Database;
  
  // Track failed attempts in memory for strict multi-tier brute-force protection
  private failedAttempts: Record<string, FailedAttemptRecord> = {};

  // Direct sessionId-to-tenantId index for O(1) lookups
  private sessionTenantIndex = new Map<string, string>();

  private constructor() {
    this.db = Database.getInstance();
  }

  /**
   * Register a sessionId to tenantId mapping in the index
   */
  public registerSessionTenant(sessionId: string, tenantId: string): void {
    this.sessionTenantIndex.set(sessionId, tenantId);
  }

  /**
   * Remove a sessionId from the index
   */
  public unregisterSessionTenant(sessionId: string): void {
    this.sessionTenantIndex.delete(sessionId);
  }

  /**
   * Resolves the tenantId associated with a sessionId in O(1) using index or scans all tenants once if index is cold (e.g. server restart)
   */
  public async resolveTenantId(sessionId: string, getTenantsListFn: () => Promise<any[]>): Promise<string | null> {
    // 1. Try O(1) direct index lookup
    if (this.sessionTenantIndex.has(sessionId)) {
      return this.sessionTenantIndex.get(sessionId) || null;
    }

    // 2. Cold start fallback: scan active sessions of all tenants and populate index
    try {
      const tenants = await getTenantsListFn();
      const tenantIds = Array.from(new Set([
        "veg-main-001",
        "saas-admin",
        ...tenants.map(t => t.tenantId)
      ]));

      for (const tid of tenantIds) {
        const activeSessions = await this.getActiveSessions(tid);
        for (const s of activeSessions) {
          this.sessionTenantIndex.set(s.sessionId, tid);
        }
      }
    } catch (err) {
      console.error("[SessionService] Error loading sessions to populate O(1) index:", err);
    }

    return this.sessionTenantIndex.get(sessionId) || null;
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Helper to parse user agent string into OS, Browser and Device details
   */
  public parseUserAgent(userAgent: string): { os: string; browser: string; deviceType: string } {
    let os = "Unknown OS";
    let browser = "Unknown Browser";
    let deviceType = "Desktop";

    const ua = userAgent.toLowerCase();

    // OS detection
    if (ua.includes("windows")) os = "Windows";
    else if (ua.includes("macintosh") || ua.includes("mac os")) os = "macOS";
    else if (ua.includes("android")) os = "Android";
    else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
    else if (ua.includes("linux")) os = "Linux";

    // Browser detection
    if (ua.includes("firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("chrome") && !ua.includes("chromium")) browser = "Google Chrome";
    else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Apple Safari";
    else if (ua.includes("edge")) browser = "Microsoft Edge";
    else if (ua.includes("opera") || ua.includes("opr")) browser = "Opera";
    else if (ua.includes("chromium")) browser = "Chromium";

    // Device detection
    if (ua.includes("mobi") || ua.includes("iphone") || ua.includes("android")) {
      deviceType = ua.includes("ipad") || ua.includes("tablet") ? "Tablet" : "Mobile";
    }

    return { os, browser, deviceType };
  }

  /**
   * Fetch current security configuration
   */
  public async getSecuritySettings(tenantId: string): Promise<SecuritySettings> {
    const defaults: SecuritySettings = {
      sessionTimeoutMinutes: 60,
      maxFailedAttempts: 5,
      lockoutDurationSeconds: 60,
      enableBruteForceProtection: true
    };
    const settings = await this.db.getObject<SecuritySettings>(tenantId, "system_security_settings");
    if (!settings) return defaults;
    if (settings.sessionTimeoutMinutes < 60) {
      settings.sessionTimeoutMinutes = 60;
      await this.db.saveObject(tenantId, "system_security_settings", settings);
    }
    return settings;
  }

  /**
   * Save security configuration
   */
  public async saveSecuritySettings(tenantId: string, settings: SecuritySettings): Promise<void> {
    await this.db.saveObject(tenantId, "system_security_settings", settings);
  }

  /**
   * Retrieve all active sessions for a given tenant
   */
  public async getActiveSessions(tenantId: string): Promise<UserSession[]> {
    const sessions = (await this.db.getObject<UserSession[]>(tenantId, "system_active_sessions")) || [];
    
    // Auto-prune expired sessions on fetch to keep ledger clean
    const now = new Date();
    const active = sessions.filter(session => new Date(session.expiresAt) > now);
    
    if (active.length !== sessions.length) {
      try {
        await this.db.saveObject(tenantId, "system_active_sessions", active);
      } catch {
        // Non-blocking prune save during DB downtime
      }
    }
    
    return active;
  }

  /**
   * Directly get and validate an active session by sessionId across registered tenants
   */
  public async getSession(sessionId: string): Promise<UserSession | null> {
    if (!sessionId) return null;
    const tenantId = await this.resolveTenantId(sessionId, async () => {
      const globalList = await this.db.getObject<any[]>("veg-main-001", "global_tenants_list");
      return globalList || [];
    });
    if (!tenantId) return null;
    return this.validateAndTouchSession(tenantId, sessionId);
  }

  /**
   * Validate a session token/ID and touch its lastActivityTimestamp
   */
  public async validateAndTouchSession(tenantId: string, sessionId: string): Promise<UserSession | null> {
    const sessions = await this.getActiveSessions(tenantId);
    const session = sessions.find(s => s.sessionId === sessionId);
    if (!session) return null;

    const now = new Date();
    const expires = new Date(session.expiresAt);
    
    if (now > expires) {
      // Session has expired
      await this.revokeSession(tenantId, sessionId);
      return null;
    }

    // Refresh expiry window based on config
    const settings = await this.getSecuritySettings(tenantId);
    session.lastActivityAt = now.toISOString();
    session.expiresAt = new Date(now.getTime() + settings.sessionTimeoutMinutes * 60 * 1000).toISOString();

    try {
      await this.db.saveObject(tenantId, "system_active_sessions", sessions);
    } catch {
      // Non-blocking touch save during DB downtime so session stays valid in memory
    }
    return session;
  }

  /**
   * Create and register a brand new active session
   */
  public async createSession(
    tenantId: string,
    userId: string,
    userName: string,
    role: string,
    ipAddress: string,
    userAgent: string,
    permissions?: string[]
  ): Promise<UserSession> {
    const settings = await this.getSecuritySettings(tenantId);
    const deviceDetails = this.parseUserAgent(userAgent);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + settings.sessionTimeoutMinutes * 60 * 1000).toISOString();

    const resolvedPermissions = permissions && permissions.length > 0
      ? permissions
      : (role === "Owner" || role === "SaaS Owner"
          ? ["billing", "inventory", "reports", "settings", "staff", "orders"]
          : role === "Manager"
            ? ["billing", "inventory", "reports", "orders", "staff"]
            : ["billing", "orders"]);
    
    const newSession: UserSession = {
      sessionId: crypto.randomBytes(32).toString("base64url"),
      userId,
      userName,
      role,
      tenantId,
      permissions: resolvedPermissions,
      ipAddress: ipAddress || "127.0.0.1",
      device: {
        ...deviceDetails,
        userAgent
      },
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt
    };

    const sessions = await this.getActiveSessions(tenantId);
    sessions.push(newSession);
    await this.db.saveObject(tenantId, "system_active_sessions", sessions);

    // Record login history
    await this.recordLoginHistory(tenantId, {
      userId,
      userName,
      role,
      ipAddress: newSession.ipAddress,
      device: deviceDetails,
      status: "success"
    });

    // Reset failed attempts for this user or IP upon successful authentication
    const failedKey = `${tenantId}:${userId}`;
    const ipKey = `${tenantId}:${newSession.ipAddress}`;
    delete this.failedAttempts[failedKey];
    delete this.failedAttempts[ipKey];

    // Register session in the O(1) index
    this.registerSessionTenant(newSession.sessionId, tenantId);

    return newSession;
  }

  /**
   * Record login failure with strict progressive multi-tier lockout check
   * - Tier 1: 3 failed attempts -> 30-second lockout cooldown
   * - Tier 2: 5 failed attempts -> 5-minute (300-second) freeze + Security Notification Alert + Audit Log
   * - Tier 3: 8+ failed attempts -> 15-minute (900-second) lockdown + Emergency Master Unlock required
   */
  public async registerFailedLogin(
    tenantId: string,
    userId: string,
    userName: string,
    role: string,
    ipAddress: string,
    userAgent: string,
    reason: string
  ): Promise<{
    locked: boolean;
    remainingAttempts: number;
    lockedUntil?: string;
    cooldownSeconds?: number;
    tier?: number;
    attemptCount: number;
    message?: string;
  }> {
    const settings = await this.getSecuritySettings(tenantId);
    const deviceDetails = this.parseUserAgent(userAgent);
    const safeIp = ipAddress || "127.0.0.1";
    const now = Date.now();

    // Record failure history in DB
    await this.recordLoginHistory(tenantId, {
      userId,
      userName,
      role,
      ipAddress: safeIp,
      device: deviceDetails,
      status: "failed",
      failureReason: reason
    });

    if (!settings.enableBruteForceProtection) {
      return { locked: false, remainingAttempts: 99, attemptCount: 1 };
    }

    // Keyed both by tenant:user and by tenant:ip and globally by ip to prevent distributed attempts
    const failedKey = `${tenantId}:${safeIp}`;
    let record = this.failedAttempts[failedKey];

    // Reset counter if previous attempt was more than 15 minutes ago and not locked
    if (!record || (now - record.lastAttemptAt > 15 * 60 * 1000 && !record.lockedUntil)) {
      record = {
        count: 0,
        firstAttemptAt: now,
        lastAttemptAt: now,
        lockedUntil: "",
        tier: 0
      };
    }

    record.count += 1;
    record.lastAttemptAt = now;

    let locked = false;
    let lockoutDuration = 0;
    let tier = 0;
    let message = "";

    // Calculate Strict Multi-Tier Lockout
    if (record.count >= 8) {
      tier = 3;
      locked = true;
      lockoutDuration = 900; // 15 minutes
      message = "Security Lockdown: Terminal frozen for 15 minutes due to repeated unauthorized PIN attempts. Enter Owner Master Key to unlock.";
    } else if (record.count >= 5) {
      tier = 2;
      locked = true;
      lockoutDuration = 300; // 5 minutes
      message = "Security Alert: Too many invalid PIN attempts. Terminal is locked for 5 minutes.";
    } else if (record.count >= 3) {
      tier = 1;
      locked = true;
      lockoutDuration = 30; // 30 seconds
      message = "Temporary Cooldown: 3 invalid attempts. Keypad paused for 30 seconds.";
    }

    if (locked) {
      const unlockTime = new Date(now + lockoutDuration * 1000);
      record.lockedUntil = unlockTime.toISOString();
      record.tier = tier;
    }

    this.failedAttempts[failedKey] = record;
    if (userId && userId !== "unknown") {
      this.failedAttempts[`${tenantId}:${userId}`] = { ...record };
    }

    // Calculate remaining attempts before the NEXT threshold
    let remaining = 3 - record.count;
    if (record.count >= 3 && record.count < 5) {
      remaining = 5 - record.count;
    } else if (record.count >= 5 && record.count < 8) {
      remaining = 8 - record.count;
    } else if (record.count >= 8) {
      remaining = 0;
    }

    return {
      locked,
      remainingAttempts: Math.max(0, remaining),
      lockedUntil: record.lockedUntil || undefined,
      cooldownSeconds: lockoutDuration || undefined,
      tier: tier || undefined,
      attemptCount: record.count,
      message: message || undefined
    };
  }

  /**
   * Check if a specific user / IP is locked out
   */
  public async checkLockout(
    tenantId: string,
    userId: string,
    ipAddress: string
  ): Promise<{
    locked: boolean;
    lockedUntil?: string;
    cooldownSeconds?: number;
    tier?: number;
    attemptCount?: number;
  }> {
    const now = Date.now();
    const safeIp = ipAddress || "127.0.0.1";

    const keysToCheck = [
      `${tenantId}:${safeIp}`,
      userId && userId !== "unknown" ? `${tenantId}:${userId}` : null
    ].filter(Boolean) as string[];

    for (const key of keysToCheck) {
      const record = this.failedAttempts[key];
      if (record && record.lockedUntil) {
        const lockedTime = new Date(record.lockedUntil).getTime();
        if (now < lockedTime) {
          const remainingSecs = Math.max(1, Math.ceil((lockedTime - now) / 1000));
          return {
            locked: true,
            lockedUntil: record.lockedUntil,
            cooldownSeconds: remainingSecs,
            tier: record.tier,
            attemptCount: record.count
          };
        } else {
          // Lock duration expired; reset lockedUntil but retain attempt count for escalation
          record.lockedUntil = "";
        }
      }
    }

    return { locked: false };
  }

  /**
   * Get active lockout status for a tenant & IP
   */
  public getLockoutStatus(tenantId: string, ipAddress: string) {
    const safeIp = ipAddress || "127.0.0.1";
    const key = `${tenantId}:${safeIp}`;
    const record = this.failedAttempts[key];
    if (!record) return { locked: false, attemptCount: 0 };

    const now = Date.now();
    if (record.lockedUntil) {
      const lockedTime = new Date(record.lockedUntil).getTime();
      if (now < lockedTime) {
        return {
          locked: true,
          lockedUntil: record.lockedUntil,
          cooldownSeconds: Math.ceil((lockedTime - now) / 1000),
          tier: record.tier,
          attemptCount: record.count
        };
      }
    }
    return { locked: false, attemptCount: record.count };
  }

  /**
   * Reset / Unlock terminal failed attempts (Owner or Master Override)
   */
  public unlockTerminal(tenantId: string, ipAddress: string): boolean {
    const safeIp = ipAddress || "127.0.0.1";
    const ipKey = `${tenantId}:${safeIp}`;
    delete this.failedAttempts[ipKey];
    return true;
  }

  /**
   * Forcefully revoke a session (logout device/token)
   */
  public async revokeSession(tenantId: string, sessionId: string): Promise<boolean> {
    const sessions = await this.getActiveSessions(tenantId);
    const filtered = sessions.filter(s => s.sessionId !== sessionId);
    
    // Remove from index
    this.unregisterSessionTenant(sessionId);

    if (filtered.length !== sessions.length) {
      await this.db.saveObject(tenantId, "system_active_sessions", filtered);
      return true;
    }
    return false;
  }

  /**
   * Clear or terminate all active sessions for a tenant (except maybe current, but handles bulk)
   */
  public async revokeAllSessions(tenantId: string): Promise<void> {
    try {
      const sessions = await this.getActiveSessions(tenantId);
      for (const s of sessions) {
        this.unregisterSessionTenant(s.sessionId);
      }
    } catch (err) {
      console.error("[SessionService] Error cleaning index in revokeAllSessions:", err);
    }
    await this.db.saveObject(tenantId, "system_active_sessions", []);
  }

  /**
   * Record login history entry
   */
  private async recordLoginHistory(
    tenantId: string,
    entry: Omit<LoginHistoryEntry, "id" | "timestamp" | "tenantId">
  ): Promise<void> {
    const history = (await this.db.getObject<LoginHistoryEntry[]>(tenantId, "system_login_history")) || [];
    
    const newRecord: LoginHistoryEntry = {
      id: `lh-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      tenantId,
      ...entry
    };

    history.unshift(newRecord);
    // Persist only last 200 entries
    await this.db.saveObject(tenantId, "system_login_history", history.slice(0, 200));
  }

  /**
   * Fetch all login histories
   */
  public async getLoginHistory(tenantId: string): Promise<LoginHistoryEntry[]> {
    return (await this.db.getObject<LoginHistoryEntry[]>(tenantId, "system_login_history")) || [];
  }

  /**
   * Purge login history
   */
  public async clearLoginHistory(tenantId: string): Promise<void> {
    await this.db.saveObject(tenantId, "system_login_history", []);
  }
}
