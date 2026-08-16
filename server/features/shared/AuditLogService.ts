import crypto from "crypto";
import { Database } from "./database";
import { NotificationService } from "../notifications/NotificationService";

export interface AuditLogEntry {
  id: string;
  sequenceId: number;
  timestamp: string;
  eventType: string;
  actor: string;
  description: string;
  details: any;
  previousHash: string;
  hash: string;
  immutable: boolean;
}

export class AuditLogService {
  private static instance: AuditLogService;
  private db: Database;

  private constructor() {
    this.db = Database.getInstance();
  }

  public static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  /**
   * Fetch all audit log entries for a tenant
   */
  public async getLogs(tenantId: string): Promise<AuditLogEntry[]> {
    return (await this.db.getObject<AuditLogEntry[]>(tenantId, "system_audit_logs")) || [];
  }

  /**
   * Calculate SHA-256 cryptographic hash chaining for audit integrity
   */
  private computeHash(
    sequenceId: number,
    timestamp: string,
    eventType: string,
    actor: string,
    description: string,
    details: any,
    previousHash: string
  ): string {
    const payload = `${sequenceId}|${timestamp}|${eventType}|${actor}|${description}|${JSON.stringify(details || {})}|${previousHash}`;
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  /**
   * Append a new cryptographic immutable audit log entry
   */
  public async log(
    tenantId: string,
    eventType: string,
    actor: string,
    description: string,
    details: any = {}
  ): Promise<string> {
    const logs = await this.getLogs(tenantId);
    const lastEntry = logs[0]; // logs stored in reverse-chronological order (newest first)

    const sequenceId = lastEntry ? (lastEntry.sequenceId || logs.length) + 1 : 1;
    const previousHash = lastEntry && lastEntry.hash ? lastEntry.hash : "GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000000";
    const timestamp = new Date().toISOString();
    const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const hash = this.computeHash(
      sequenceId,
      timestamp,
      eventType,
      actor,
      description,
      details,
      previousHash
    );

    const newEntry: AuditLogEntry = {
      id,
      sequenceId,
      timestamp,
      eventType,
      actor,
      description,
      details,
      previousHash,
      hash,
      immutable: true
    };

    logs.unshift(newEntry);
    // Keep last 300 entries for audit trail
    await this.db.saveObject(tenantId, "system_audit_logs", logs.slice(0, 300));

    // Problem 6 Solution 3: Trigger real-time notifications for critical security events
    const criticalEvents = [
      "ORDER_CANCELLED",
      "DISCOUNT_APPLIED",
      "PRICE_CHANGE",
      "CASH_DRAWER_OPENED",
      "SHIFT_VARIANCE_OVERRIDE",
      "UNAUTHORIZED_ACCESS",
      "ROLE_UPDATED"
    ];

    if (criticalEvents.includes(eventType)) {
      try {
        await NotificationService.getInstance().send(tenantId, {
          title: `🚨 Security Audit Alert: ${eventType.replace(/_/g, " ")}`,
          message: `[Seq #${sequenceId}] ${description} (Authorizer: ${actor})`,
          severity: "warning",
          channels: ["in-app"],
          metadata: { sequenceId, eventType, actor, details, hash: hash.substring(0, 10) }
        });
      } catch (err) {
        console.error("Failed to send real-time audit alert notification:", err);
      }
    }

    return id;
  }

  /**
   * Block wiping or clearing audit log records (Problem 6 Solution 1: Immutable)
   */
  public async clearLogs(tenantId: string): Promise<void> {
    throw new Error("SECURITY_RESTRICTION: Audit logs are immutable, append-only records with cryptographic signatures and CANNOT be deleted or cleared.");
  }
}
