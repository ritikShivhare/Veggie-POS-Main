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
  request_hash?: string;
  status?: "PROCESSING" | "COMPLETED" | "FAILED";
  expires_at?: string;
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

export class IdempotencyPayloadMismatchError extends Error {
  public code = "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH";
  public statusCode = 422;
  constructor(message: string = "Idempotency key was previously used with a different request payload.") {
    super(message);
    this.name = "IdempotencyPayloadMismatchError";
  }
}

/**
 * Deterministically serializes JSON objects with sorted keys to ensure stable cryptographic hashing
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || obj === undefined) return "";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonStringify).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJsonStringify(obj[k])).join(",") + "}";
}

/**
 * Computes a SHA-256 fingerprint of the request payload
 */
export function computeRequestHash(body: any): string {
  const canonical = canonicalJsonStringify(body);
  return crypto.createHash("sha256").update(canonical).digest("hex");
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
  public getCompositeKey(tenantId: string, idempotencyKey: string): string {
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
   * Aborts an in-flight request lock if the original request errored or terminated abnormally.
   * If the reservation was only in PROCESSING state, deletes it to allow safe retry.
   */
  public abortInFlight(tenantId: string, idempotencyKey: string, error?: any): void {
    const key = this.getCompositeKey(tenantId, idempotencyKey);
    const inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      inFlight.reject(error || new Error("In-flight idempotency request aborted"));
      this.inFlightRequests.delete(key);
    }

    // Clean up temporary processing reservation so future retries are not blocked
    const existing = this.inMemoryRecords.get(key);
    if (existing && existing.status === "PROCESSING") {
      this.inMemoryRecords.delete(key);

      const database = Database.getInstance();
      const client = (database as any).getSupabaseClient();
      if (client) {
        client
          .from("idempotency_keys")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("idempotency_key", idempotencyKey)
          .eq("status", "PROCESSING")
          .then(() => {})
          .catch(() => {});
      }
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
          request_hash: data.request_hash,
          status: data.status || "COMPLETED",
          expires_at: data.expires_at,
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
   * Reserves an idempotency key atomically before business execution.
   * Performs cryptographic request fingerprint validation and enforces:
   * - Same tenant + key + payload = replay previous result
   * - Same tenant + key + different payload = deterministic 422 rejection
   * - Concurrent requests serialize safely across instances
   */
  public async reserveOrGetRecord(
    tenantId: string,
    idempotencyKey: string,
    requestHash?: string,
    requestPath?: string,
    requestMethod?: string
  ): Promise<
    | { status: "RESERVED" }
    | { status: "COMPLETED"; record: IdempotencyRecord }
    | { status: "PROCESSING"; record: IdempotencyRecord }
  > {
    const compositeKey = this.getCompositeKey(tenantId, idempotencyKey);
    const now = Date.now();
    const leaseTimeMs = 60 * 1000; // 60s lease for crashed process recovery
    const expiresAt = new Date(now + leaseTimeMs).toISOString();

    // 1. Check existing record in memory or DB, or in-flight mutex
    const existing = await this.getRecord(tenantId, idempotencyKey);
    const inFlightActive = this.isInFlight(tenantId, idempotencyKey);

    if (existing || inFlightActive) {
      if (existing) {
        // STEP 2 SEMANTICS: Same key + different request payload = deterministic rejection!
        if (
          requestHash &&
          existing.request_hash &&
          existing.request_hash !== requestHash
        ) {
          throw new IdempotencyPayloadMismatchError(
            `Idempotency key '${idempotencyKey}' was previously used with a different request payload.`
          );
        }

        if (existing.status === "COMPLETED" || (!existing.status && existing.status_code > 0)) {
          return { status: "COMPLETED", record: existing };
        }

        // Check if processing lease expired (worker crashed)
        if (existing.expires_at && new Date(existing.expires_at).getTime() < now) {
          console.warn(`[Idempotency] Key '${idempotencyKey}' processing lease expired. Reclaiming lock.`);
          existing.expires_at = expiresAt;
          existing.request_hash = requestHash || existing.request_hash;
          existing.status = "PROCESSING";
          this.inMemoryRecords.set(compositeKey, existing);
          this.startInFlight(tenantId, idempotencyKey);
          return { status: "RESERVED" };
        }

        return { status: "PROCESSING", record: existing };
      }

      // in-flight active without saved record yet
      return {
        status: "PROCESSING",
        record: {
          id: "",
          tenant_id: tenantId,
          idempotency_key: idempotencyKey,
          status_code: 0,
          response_body: null,
          status: "PROCESSING"
        }
      };
    }

    // 2. No record exists: create atomic reservation
    const id = crypto.randomUUID();
    const newRecord: IdempotencyRecord = {
      id,
      tenant_id: tenantId,
      idempotency_key: idempotencyKey,
      status_code: 0,
      response_body: null,
      request_path: requestPath,
      request_method: requestMethod,
      request_hash: requestHash,
      status: "PROCESSING",
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    // Database reservation via Supabase if configured
    const database = Database.getInstance();
    const client = (database as any).getSupabaseClient();

    if (client) {
      try {
        const { error } = await client
          .from("idempotency_keys")
          .insert({
            id: newRecord.id,
            tenant_id: newRecord.tenant_id,
            idempotency_key: newRecord.idempotency_key,
            status_code: 0,
            response_body: {},
            request_path: newRecord.request_path,
            request_method: newRecord.request_method,
            request_hash: newRecord.request_hash,
            status: "PROCESSING",
            expires_at: newRecord.expires_at,
            created_at: newRecord.created_at
          });

        if (error) {
          // If unique constraint violation occurs (code 23505), another worker reserved it first!
          if (error.code === "23505" || error.message?.includes("unique") || error.message?.includes("duplicate")) {
            const dbExisting = await this.getRecord(tenantId, idempotencyKey);
            if (dbExisting) {
              if (requestHash && dbExisting.request_hash && dbExisting.request_hash !== requestHash) {
                throw new IdempotencyPayloadMismatchError(
                  `Idempotency key '${idempotencyKey}' was previously used with a different request payload.`
                );
              }
              if (dbExisting.status === "COMPLETED" || (!dbExisting.status && dbExisting.status_code > 0)) {
                return { status: "COMPLETED", record: dbExisting };
              }
              return { status: "PROCESSING", record: dbExisting };
            }
          }
        }
      } catch (err: any) {
        if (err instanceof IdempotencyPayloadMismatchError) throw err;
        console.warn(`[Idempotency] DB reservation error for key ${idempotencyKey}:`, err.message || err);
      }
    }

    // Set local in-memory reservation
    this.inMemoryRecords.set(compositeKey, newRecord);
    this.startInFlight(tenantId, idempotencyKey);

    return { status: "RESERVED" };
  }

  /**
   * Saves a completed idempotency response record with UNIQUE(tenant_id, idempotency_key) constraint.
   */
  public async saveRecord(record: Omit<IdempotencyRecord, "id"> & { id?: string }): Promise<IdempotencyRecord> {
    const compositeKey = this.getCompositeKey(record.tenant_id, record.idempotency_key);
    const existing = this.inMemoryRecords.get(compositeKey);

    // If existing completed record exists, do not overwrite, enforce unique constraint
    if (existing && (existing.status === "COMPLETED" || (!existing.status && existing.status_code > 0))) {
      // If request hash is provided and doesn't match, throw payload mismatch error
      if (record.request_hash && existing.request_hash && existing.request_hash !== record.request_hash) {
        throw new IdempotencyPayloadMismatchError(
          `Idempotency key '${record.idempotency_key}' was previously used with a different request payload.`
        );
      }
      const inFlight = this.inFlightRequests.get(compositeKey);
      if (inFlight) {
        inFlight.resolve(existing);
        this.inFlightRequests.delete(compositeKey);
      }
      return existing;
    }

    const id = record.id || (existing ? existing.id : crypto.randomUUID());
    const finalRecord: IdempotencyRecord = {
      id,
      tenant_id: record.tenant_id,
      idempotency_key: record.idempotency_key,
      status_code: record.status_code,
      response_body: record.response_body,
      request_path: record.request_path || existing?.request_path,
      request_method: record.request_method || existing?.request_method,
      request_hash: record.request_hash || existing?.request_hash,
      status: record.status || "COMPLETED",
      expires_at: record.expires_at,
      created_at: record.created_at || existing?.created_at || new Date().toISOString()
    };

    this.inMemoryRecords.set(compositeKey, finalRecord);

    // Persist/Update Supabase DB
    const database = Database.getInstance();
    const client = (database as any).getSupabaseClient();
    if (client) {
      try {
        const { error } = await client
          .from("idempotency_keys")
          .upsert({
            id: finalRecord.id,
            tenant_id: finalRecord.tenant_id,
            idempotency_key: finalRecord.idempotency_key,
            status_code: finalRecord.status_code,
            response_body: finalRecord.response_body,
            request_path: finalRecord.request_path,
            request_method: finalRecord.request_method,
            request_hash: finalRecord.request_hash,
            status: finalRecord.status,
            expires_at: finalRecord.expires_at,
            created_at: finalRecord.created_at
          });

        if (error) {
          console.warn(`[Idempotency] DB upsert warning for key ${finalRecord.idempotency_key}:`, error.message);
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
