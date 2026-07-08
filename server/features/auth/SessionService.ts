import { Database } from "../shared/database";

export interface UserSession {
  sessionId: string;
  userId: string;
  userName: string;
  role: string;
  tenantId: string;
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

export class SessionService {
  private static instance: SessionService;
  private db: Database;
  
  // Track failed attempts in memory for transient brute-force protection
  private failedAttempts: Record<string, { count: number; lockedUntil: string }> = {};

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
      sessionTimeoutMinutes: 15,
      maxFailedAttempts: 3,
      lockoutDurationSeconds: 60,
      enableBruteForceProtection: true
    };
    return (await this.db.getObject<SecuritySettings>(tenantId, "system_security_settings")) || defaults;
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
      await this.db.saveObject(tenantId, "system_active_sessions", active);
    }
    
    return active;
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

    await this.db.saveObject(tenantId, "system_active_sessions", sessions);
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
    userAgent: string
  ): Promise<UserSession> {
    const settings = await this.getSecuritySettings(tenantId);
    const deviceDetails = this.parseUserAgent(userAgent);
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + settings.sessionTimeoutMinutes * 60 * 1000).toISOString();
    
    const newSession: UserSession = {
      sessionId: `sess-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      userId,
      userName,
      role,
      tenantId,
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
   * Record login failure with lockout check
   */
  public async registerFailedLogin(
    tenantId: string,
    userId: string,
    userName: string,
    role: string,
    ipAddress: string,
    userAgent: string,
    reason: string
  ): Promise<{ locked: boolean; remainingAttempts: number; lockedUntil?: string }> {
    const settings = await this.getSecuritySettings(tenantId);
    const deviceDetails = this.parseUserAgent(userAgent);

    // Record failure history
    await this.recordLoginHistory(tenantId, {
      userId,
      userName,
      role,
      ipAddress: ipAddress || "127.0.0.1",
      device: deviceDetails,
      status: "failed",
      failureReason: reason
    });

    if (!settings.enableBruteForceProtection) {
      return { locked: false, remainingAttempts: 99 };
    }

    const failedKey = userId ? `${tenantId}:${userId}` : `${tenantId}:${ipAddress}`;
    const current = this.failedAttempts[failedKey] || { count: 0, lockedUntil: "" };
    
    current.count += 1;
    let locked = false;
    let lockedUntilStr = "";

    if (current.count >= settings.maxFailedAttempts) {
      locked = true;
      const unlockTime = new Date(Date.now() + settings.lockoutDurationSeconds * 1000);
      current.lockedUntil = unlockTime.toISOString();
      lockedUntilStr = current.lockedUntil;
    }

    this.failedAttempts[failedKey] = current;
    
    return {
      locked,
      remainingAttempts: Math.max(0, settings.maxFailedAttempts - current.count),
      lockedUntil: lockedUntilStr || undefined
    };
  }

  /**
   * Check if a specific user / IP is locked out
   */
  public async checkLockout(tenantId: string, userId: string, ipAddress: string): Promise<{ locked: boolean; lockedUntil?: string }> {
    const now = new Date();
    
    // Check key for user
    const userKey = `${tenantId}:${userId}`;
    const userLock = this.failedAttempts[userKey];
    if (userLock && userLock.lockedUntil) {
      const lockedTime = new Date(userLock.lockedUntil);
      if (now < lockedTime) {
        return { locked: true, lockedUntil: userLock.lockedUntil };
      } else {
        // Lock has expired, clean it up
        delete this.failedAttempts[userKey];
      }
    }

    // Check key for IP
    const ipKey = `${tenantId}:${ipAddress}`;
    const ipLock = this.failedAttempts[ipKey];
    if (ipLock && ipLock.lockedUntil) {
      const lockedTime = new Date(ipLock.lockedUntil);
      if (now < lockedTime) {
        return { locked: true, lockedUntil: ipLock.lockedUntil };
      } else {
        // Lock has expired, clean it up
        delete this.failedAttempts[ipKey];
      }
    }

    return { locked: false };
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
