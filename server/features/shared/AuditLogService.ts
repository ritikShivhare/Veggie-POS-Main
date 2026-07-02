import { Database } from "./database";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  actor: string;
  description: string;
  details: any;
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
   * Append a new audit log entry
   */
  public async log(
    tenantId: string,
    eventType: string,
    actor: string,
    description: string,
    details: any = {}
  ): Promise<string> {
    const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const logs = await this.getLogs(tenantId);

    const newEntry: AuditLogEntry = {
      id,
      timestamp: new Date().toISOString(),
      eventType,
      actor,
      description,
      details
    };

    logs.unshift(newEntry);
    // Keep last 150 entries
    await this.db.saveObject(tenantId, "system_audit_logs", logs.slice(0, 150));
    return id;
  }

  /**
   * Clear all audit log records
   */
  public async clearLogs(tenantId: string): Promise<void> {
    await this.db.saveObject(tenantId, "system_audit_logs", []);
  }
}
