import crypto from "crypto";
import { Database } from "./database";

export interface IdempotencyRecord {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  status_code: number;
  response_body: any;
  request_path?: string;
  request_method?: string;
  created_at?: string;
}

export class IdempotencyConflictError extends Error {
  public code = "IDEMPOTENCY_CONFLICT";
  public statusCode = 409;
  constructor(message: string = "A concurrent request with the same idempotency key is currently processing.") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyService {
  private static instance: IdempotencyService;

  // In-memory relational emulation layer enforcing UNIQUE(tenant_id, idempotency_key)
  private inMemoryRecords: Map<string, IdempotencyRecord> = new Map();

  // In-flight mutex promises for concurrent duplicate request resolution
  private inFlightRequests: Map<string, {
    promise: Promise<IdempotencyRecord>;
    resolve: (val: IdempotencyRecord) => void;
    reject: (err: any) => void;
  }> = new Map();

  private constructor() {}

  public static getInstance(): IdempotencyService {
    if (!IdempotencyService.instance) {
      IdempotencyService.instance = new IdempotencyService();
    }
    return IdempotencyService.instance;
  }

  /**
   * Generates composite primary unique key for tenant and idempotency key
   */
  private getCompositeKey(tenantId: string, idempotencyKey: string): string {
    return `${tenantId}::${idempotencyKey}`;
  }

  /**
   * Checks if an idempotency key is currently in-flight
   */
  public isInFlight(tenantId: string, idempotencyKey: string): boolean {
    const key = this.getCompositeKey(tenantId, idempotencyKey);
    return this.inFlightRequests.has(key);
  }

  /**
   * Waits for an in-flight request with the same idempotency key to complete
   */
  public async waitForInFlight(tenantId: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const key = this.getCompositeKey(tenantId, idempotencyKey);
    const inFlight = this.inFlightRequests.get(key);
    if (!inFlight) {
      return this.getRecord(tenantId, idempotencyKey);
    }
    try {
      return await inFlight.promise;
    } catch {
      return this.getRecord(tenantId, idempotencyKey);
    }
  }

  /**
   * Registers an in-flight request lock for the idempotency key
   */
  public startInFlight(tenantId: string, idempotencyKey: string): void {
    const key = this.getCompositeKey(tenantId, idempotencyKey);
    if (this.inFlightRequests.has(key)) return;

    let resolveFn!: (val: IdempotencyRecord) => void;
    let rejectFn!: (err: any) => void;
    const promise = new Promise<IdempotencyRecord>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    this.inFlightRequests.set(key, { promise, resolve: resolveFn, reject: rejectFn });
  }

  /**
   * Aborts an in-flight request lock if the original request errored or terminated abnormally
   */
  public abortInFlight(tenantId: string, idempotencyKey: string, error?: any): void {
    const key = this.getCompositeKey(tenantId, idempotencyKey);
    const inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      inFlight.reject(error || new Error("In-flight idempotency request aborted"));
      this.inFlightRequests.delete(key);
    }
  }

  /**
   * Retrieves an existing idempotency record for (tenant_id, idempotency_key).
   * Returns null if no previous request exists.
   */
  public async getRecord(tenantId: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const compositeKey = this.getCompositeKey(tenantId, idempotencyKey);

    // 1. Check local in-memory registry first
    const local = this.inMemoryRecords.get(compositeKey);
    if (local) {
      return local;
    }

    // 2. Query Supabase database if configured
    const database = Database.getInstance();
    const client = (database as any).getSupabaseClient();
    if (!client) {
      return null;
    }

    try {
      const { data, error } = await client
        .from("idempotency_keys")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (error) {
        console.warn(`[Idempotency] Supabase lookup warning for key ${idempotencyKey} on tenant ${tenantId}:`, error.message);
        return null;
      }

      if (data) {
        const record: IdempotencyRecord = {
          id: data.id,
          tenant_id: data.tenant_id,
          idempotency_key: data.idempotency_key,
          status_code: data.status_code,
          response_body: data.response_body,
          request_path: data.request_path,
          request_method: data.request_method,
          created_at: data.created_at
        };
        // Cache in-memory
        this.inMemoryRecords.set(compositeKey, record);
        return record;
      }
    } catch (err: any) {
      console.warn(`[Idempotency] Error querying idempotency record for ${idempotencyKey}:`, err.message || err);
    }

    return null;
  }

  /**
   * Saves a completed idempotency response record with UNIQUE(tenant_id, idempotency_key) constraint.
   */
  public async saveRecord(record: Omit<IdempotencyRecord, "id"> & { id?: string }): Promise<IdempotencyRecord> {
    const compositeKey = this.getCompositeKey(record.tenant_id, record.idempotency_key);
    const id = record.id || crypto.randomUUID();
    const finalRecord: IdempotencyRecord = {
      id,
      tenant_id: record.tenant_id,
      idempotency_key: record.idempotency_key,
      status_code: record.status_code,
      response_body: record.response_body,
      request_path: record.request_path,
      request_method: record.request_method,
      created_at: record.created_at || new Date().toISOString()
    };

    // Enforce in-memory unique constraint on (tenant_id, idempotency_key)
    if (this.inMemoryRecords.has(compositeKey)) {
      const existing = this.inMemoryRecords.get(compositeKey)!;
      // Resolve any waiting in-flight promises with the existing record
      const inFlight = this.inFlightRequests.get(compositeKey);
      if (inFlight) {
        inFlight.resolve(existing);
        this.inFlightRequests.delete(compositeKey);
      }
      return existing;
    }

    this.inMemoryRecords.set(compositeKey, finalRecord);

    // Persist to Supabase if configured
    const database = Database.getInstance();
    const client = (database as any).getSupabaseClient();

    if (client) {
      try {
        const { error } = await client
          .from("idempotency_keys")
          .insert({
            id: finalRecord.id,
            tenant_id: finalRecord.tenant_id,
            idempotency_key: finalRecord.idempotency_key,
            status_code: finalRecord.status_code,
            response_body: finalRecord.response_body,
            request_path: finalRecord.request_path,
            request_method: finalRecord.request_method,
            created_at: finalRecord.created_at
          });

        if (error) {
          // If unique constraint violation occurs (code 23505), fetch existing record
          if (error.code === "23505" || error.message?.includes("unique") || error.message?.includes("duplicate")) {
            console.log(`[Idempotency] Unique constraint hit for (${finalRecord.tenant_id}, ${finalRecord.idempotency_key}). Re-fetching previous response.`);
            const existing = await this.getRecord(finalRecord.tenant_id, finalRecord.idempotency_key);
            if (existing) {
              const inFlight = this.inFlightRequests.get(compositeKey);
              if (inFlight) {
                inFlight.resolve(existing);
                this.inFlightRequests.delete(compositeKey);
              }
              return existing;
            }
          } else {
            console.warn(`[Idempotency] DB insert warning for key ${finalRecord.idempotency_key}:`, error.message);
          }
        }
      } catch (err: any) {
        console.warn(`[Idempotency] Error saving idempotency record to DB:`, err.message || err);
      }
    }

    // Resolve any waiting in-flight listeners with newly persisted record
    const inFlight = this.inFlightRequests.get(compositeKey);
    if (inFlight) {
      inFlight.resolve(finalRecord);
      setTimeout(() => {
        this.inFlightRequests.delete(compositeKey);
      }, 50);
    }

    return finalRecord;
  }

  /**
   * Resets local state (useful for unit testing)
   */
  public clearMemory(): void {
    this.inMemoryRecords.clear();
    this.inFlightRequests.clear();
  }
}
