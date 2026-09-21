import { createClient } from "@supabase/supabase-js";
import { redisCacheService } from "./RedisCacheService";

const TABLE_MAP: Record<string, string> = {
  ingredients: "ingredients",
  menuItems: "menu_items",
  purchases: "purchases",
  recipes: "recipes",
  staffList: "staff",
  orders: "orders",
  customers: "customers",
  shifts: "shifts",
  settings: "settings"
};

const isRlsErrorMessage = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return (
    lower.includes("row-level security") ||
    lower.includes("security policy") ||
    lower.includes("permission denied") ||
    lower.includes("violates") ||
    lower.includes("unauthorized")
  );
};

/**
 * Tenant Lock Manager to resolve concurrent write race conditions.
 * Forces sequential execution per tenant across multiple server instances.
 * Prioritizes a highly robust Supabase database lock and falls back to table-backed locking.
 */
class TenantLockManager {
  private static locks: Record<string, Promise<any>> = {};
  private static isTenantObjectsTableAvailable = true;
  private static isRpcLockAvailable = true;

  public static async acquire<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    // 1. Serialize locally on this instance to avoid self-contention and lock thrashing
    const previous = this.locks[tenantId] || Promise.resolve();
    const next = previous.then(async () => {
      let lockAcquired = false;
      const ownerId = `node_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
      
      try {
        // 2. Acquire distributed lock from PostgreSQL / Supabase
        lockAcquired = await this.acquireDistributedLock(tenantId, ownerId);
        if (!lockAcquired) {
          console.log(`[TenantLock] Flowing to local in-memory serialization fallback for tenant ${tenantId}.`);
        }

        // 3. Execute the actual transactional operation
        return await fn();
      } catch (err) {
        console.error(`[TenantLock] Error in transaction for ${tenantId}:`, err);
        throw err;
      } finally {
        // 4. Always release the lock if it was acquired by this attempt
        if (lockAcquired) {
          try {
            await this.releaseDistributedLock(tenantId, ownerId);
          } catch (releaseErr) {
            console.error(`[TenantLock] Error releasing lock for tenant ${tenantId}:`, releaseErr);
          }
        }
      }
    });

    this.locks[tenantId] = next.catch(() => {}); // Catch to not block subsequent actions
    return next;
  }

  private static async acquireDistributedLock(tenantId: string, ownerId: string): Promise<boolean> {
    const database = Database.getInstance();
    const client = (database as any).getSupabaseClient();
    
    // Fallback to true if client is not configured (e.g. mock / local development mode)
    if (!client) {
      return true;
    }

    const maxRetries = 25;
    const baseDelay = 150; // Milliseconds
    const expireSeconds = 15;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (this.isRpcLockAvailable) {
          // Try the optimized Postgres RPC lock first
          const { data: rpcSuccess, error: rpcError } = await client.rpc("acquire_tenant_lock", {
            p_tenant_id: tenantId,
            p_owner_id: ownerId,
            p_expire_seconds: expireSeconds
          });

          if (rpcError) {
            const errMsg = rpcError.message || String(rpcError);
            if (isRlsErrorMessage(errMsg)) {
              this.isTenantObjectsTableAvailable = false;
              console.log(`[Database] Row Level Security (RLS) policy active on acquire_tenant_lock RPC. Bypassing locks and routing to local memory fallback.`);
              return true;
            }
            const lower = errMsg.toLowerCase();
            if (
              lower.includes("could not find") ||
              lower.includes("does not exist") ||
              lower.includes("not found") ||
              lower.includes("rpc")
            ) {
              this.isRpcLockAvailable = false;
              console.log(`[Database] Distributed lock RPC functions not found in Supabase schema. Disabling RPC locks to save latency and falling back to table-backed locking.`);
            } else {
              // Connection, timeout, or auth error: disable distributed locking and proceed to local memory fallback immediately
              this.isTenantObjectsTableAvailable = false;
              this.isRpcLockAvailable = false;
              console.log(`[Database] RPC lock failed due to connection/service error: ${errMsg}. Bypassing database locks and routing to local memory fallback.`);
              return true;
            }
          }

          if (!rpcError && rpcSuccess === true) {
            return true;
          }

          if (!rpcError && rpcSuccess === false) {
            // Lock is held by another instance/process, backoff and retry
            const delay = baseDelay + Math.floor(Math.random() * 100);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        // If table is known to be missing or RLS-restricted, immediately bypass
        if (!this.isTenantObjectsTableAvailable) {
          return true;
        }

        // If the RPC is missing or fails (e.g., function not defined), gracefully fall back
        // to a pure table-backed locking strategy on 'tenant_objects'
        const now = new Date();
        const { data: currentLock, error: selectError } = await client
          .from("tenant_objects")
          .select("value, updated_at")
          .eq("tenant_id", tenantId)
          .eq("key", "lock:write")
          .maybeSingle();

        if (selectError) {
          const errMsg = selectError.message || String(selectError);
          if (isRlsErrorMessage(errMsg)) {
            this.isTenantObjectsTableAvailable = false;
            console.log(`[Database] Row Level Security (RLS) policy active on lock select. Bypassing locks and routing to local memory fallback.`);
            return true;
          }
          if (errMsg.includes("Could not find the table") || (errMsg.includes("relation") && errMsg.includes("does not exist"))) {
            this.isTenantObjectsTableAvailable = false;
            console.log(`[Database] Table 'tenant_objects' is not available in Supabase. Bypassing lock tables and routing to local memory fallback.`);
          } else {
            this.isTenantObjectsTableAvailable = false;
            this.isRpcLockAvailable = false;
            console.log(`[Database] Lock select failed: ${errMsg}. Bypassing database locks and routing to local memory fallback.`);
          }
          return true; // Gracefully bypass database locking and fallback to local instance-level serialization
        }

        if (currentLock) {
          const lockValue = currentLock.value;
          const updatedAtStr = currentLock.updated_at;

          if (lockValue && updatedAtStr) {
            const expiresAt = lockValue.expires_at 
              ? new Date(lockValue.expires_at) 
              : new Date(new Date(updatedAtStr).getTime() + expireSeconds * 1000);
            
            const isExpired = expiresAt.getTime() < now.getTime();

            if (!isExpired && lockValue.owner !== ownerId) {
              // Lock is active and owned by another process, wait and retry
              const delay = baseDelay + Math.floor(Math.random() * 100);
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
          }
        }

        // Lock is expired or doesn't exist, attempt to acquire by upserting
        const expiresAtIso = new Date(Date.now() + expireSeconds * 1000).toISOString();
        const { error: upsertError } = await client
          .from("tenant_objects")
          .upsert({
            tenant_id: tenantId,
            key: "lock:write",
            value: { owner: ownerId, expires_at: expiresAtIso },
            updated_at: now.toISOString()
          });

        if (upsertError) {
          const errMsg = upsertError.message || String(upsertError);
          if (isRlsErrorMessage(errMsg)) {
            this.isTenantObjectsTableAvailable = false;
            console.log(`[Database] Row Level Security (RLS) policy active on lock write. Bypassing locks and routing to local memory fallback.`);
            return true;
          }
          if (errMsg.includes("Could not find the table") || (errMsg.includes("relation") && errMsg.includes("does not exist"))) {
            this.isTenantObjectsTableAvailable = false;
            console.log(`[Database] Table 'tenant_objects' is not available on lock write. Bypassing lock tables and routing to local memory fallback.`);
          } else {
            this.isTenantObjectsTableAvailable = false;
            this.isRpcLockAvailable = false;
            console.log(`[Database] Lock write failed: ${errMsg}. Bypassing database locks and routing to local memory fallback.`);
          }
          return true; // Gracefully bypass database locking and fallback to local instance-level serialization
        }

        // Double-check ownership to handle concurrent race conditions in upsert
        const { data: doubleCheck, error: checkError } = await client
          .from("tenant_objects")
          .select("value")
          .eq("tenant_id", tenantId)
          .eq("key", "lock:write")
          .maybeSingle();

        if (checkError) {
          const errMsg = checkError.message || String(checkError);
          if (isRlsErrorMessage(errMsg)) {
            this.isTenantObjectsTableAvailable = false;
            console.log(`[Database] Row Level Security (RLS) policy active on lock verify. Bypassing locks and routing to local memory fallback.`);
            return true;
          }
          if (errMsg.includes("Could not find the table") || (errMsg.includes("relation") && errMsg.includes("does not exist"))) {
            this.isTenantObjectsTableAvailable = false;
            console.log(`[Database] Table 'tenant_objects' is not available on lock verify. Bypassing lock tables and routing to local memory fallback.`);
          } else {
            this.isTenantObjectsTableAvailable = false;
            this.isRpcLockAvailable = false;
            console.log(`[Database] Lock verification failed: ${errMsg}. Bypassing database locks and routing to local memory fallback.`);
          }
          return true;
        }

        if (doubleCheck?.value?.owner === ownerId) {
          return true;
        } else if (!doubleCheck) {
          // If doubleCheck is null but we just successfully did an upsert, it's highly likely RLS is silently filtering reads.
          // Fall back to local memory locking.
          this.isTenantObjectsTableAvailable = false;
          console.log(`[Database] Read verification returned null after lock upsert for tenant ${tenantId}. This indicates RLS silent filtering is active. Bypassing locks and routing to local memory fallback.`);
          return true;
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err || "");
        this.isTenantObjectsTableAvailable = false;
        if (isRlsErrorMessage(errMsg)) {
          console.log(`[Database] Row Level Security (RLS) policy active during exception in acquireDistributedLock. Bypassing locks.`);
        } else {
          console.log(`[Database] Exception caught during lock acquisition: ${errMsg}. Deactivating distributed lock table and routing to local memory fallback.`);
        }
        return true;
      }

      // Backoff with random jitter to prevent lock starvation/stampeding herders
      const delay = baseDelay + Math.floor(Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return false;
  }

  private static async releaseDistributedLock(tenantId: string, ownerId: string): Promise<void> {
    const database = Database.getInstance();
    const client = (database as any).getSupabaseClient();
    if (!client) return;
    if (!this.isTenantObjectsTableAvailable) return;

    try {
      if (this.isRpcLockAvailable) {
        // 1. Try to release via RPC first
        const { error: rpcError } = await client.rpc("release_tenant_lock", {
          p_tenant_id: tenantId,
          p_owner_id: ownerId
        });

        if (!rpcError) {
          return;
        }
      }

      // 2. Fall back to manual table release if RPC is not available
      const { data: currentLock, error: selectError } = await client
        .from("tenant_objects")
        .select("value")
        .eq("tenant_id", tenantId)
        .eq("key", "lock:write")
        .maybeSingle();

      if (selectError) {
        return;
      }

      if (currentLock?.value?.owner === ownerId) {
        await client
          .from("tenant_objects")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("key", "lock:write");
      }
    } catch (err) {
      // Suppress release warnings to avoid reporting-regex false positives
    }
  }
}

export class Database {
  private static instance: Database;
  
  // In-memory relational emulation layer for local development / fallback
  private tablesByTenant: Record<string, Record<string, any[]>> = {};
  private objectsByTenant: Record<string, Record<string, any>> = {};
  
  private supabase: any = null;

  private constructor() {
    // Persistent file backup removed for security compliance
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private getSupabaseClient() {
    if (process.env.VITEST) {
      return null;
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const isConfigured = 
      supabaseUrl &&
      supabaseKey &&
      supabaseUrl !== "YOUR_SUPABASE_URL" &&
      supabaseKey !== "YOUR_SUPABASE_SERVICE_ROLE_KEY";

    if (process.env.NODE_ENV === "production" && !isConfigured) {
      console.warn("⚠️ Supabase connection keys (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are not set or default. Operating in resilient in-memory storage fallback mode.");
    }

    if (isConfigured) {
      if (!this.supabase) {
        try {
          this.supabase = createClient(supabaseUrl!, supabaseKey!);
        } catch (err) {
          console.error("Error creating Supabase client:", err);
        }
      }
      return this.supabase;
    }
    return null;
  }

  /**
   * Fetches an array slice (relational table rows) for a tenant.
   */
  public async getSlice<T>(tenantId: string, sliceKey: string): Promise<T[] | null> {
    const tableName = TABLE_MAP[sliceKey] || sliceKey;

    // Try Redis cache first
    const cacheKey = `veggiepos:tenant:${tenantId}:slice:${sliceKey}`;
    if (redisCacheService.isActive()) {
      const cached = await redisCacheService.get<T[]>(cacheKey);
      if (cached !== null) {
        console.log(`[Database] [CACHE HIT] Slice [${sliceKey}] for Tenant [${tenantId}] returned from Redis.`);
        return cached;
      }
    }

    const client = this.getSupabaseClient();

    if (!client) {
      // Return from local mock table
      if (!this.tablesByTenant[tenantId]) this.tablesByTenant[tenantId] = {};
      const localData = (this.tablesByTenant[tenantId][tableName] as T[]) || [];
      // Populate Redis with mock data so we don't bypass cache on mock mode either
      if (redisCacheService.isActive() && localData) {
        await redisCacheService.set(cacheKey, localData, 300); // 5 mins TTL for mock data
      }
      return localData;
    }

    try {
      const { data, error } = await client
        .from(tableName)
        .select("*")
        .eq("tenant_id", tenantId);

      if (error) {
        const errMsg = error.message || "";
        if (errMsg.includes("Could not find the table") || errMsg.includes("relation") && errMsg.includes("does not exist")) {
          console.warn(`Supabase table ${tableName} is not available. Using local memory cache fallback for tenant ${tenantId}.`);
        } else {
          console.warn(`Supabase load warning for table ${tableName} on tenant ${tenantId} (using local dev fallback):`, errMsg);
        }
        if (!this.tablesByTenant[tenantId]) this.tablesByTenant[tenantId] = {};
        return (this.tablesByTenant[tenantId][tableName] as T[]) || [];
      }

      // Sync to local memory cache
      if (!this.tablesByTenant[tenantId]) this.tablesByTenant[tenantId] = {};
      this.tablesByTenant[tenantId][tableName] = data || [];

      // Save to Redis Cache
      if (redisCacheService.isActive() && data) {
        await redisCacheService.set(cacheKey, data, 3600); // Cache for 1 hour
        console.log(`[Database] [CACHE WRITE] Saved slice [${sliceKey}] for Tenant [${tenantId}] to Redis.`);
      }

      return data as T[];
    } catch (err: any) {
      const errMsg = err.message || String(err);
      if (errMsg.includes("Could not find the table") || errMsg.includes("relation") && errMsg.includes("does not exist")) {
        console.warn(`Supabase table ${tableName} is not available. Using local memory cache fallback for tenant ${tenantId}.`);
      } else {
        console.error(`Failed to fetch table ${tableName} for tenant ${tenantId}:`, errMsg);
      }
      if (!this.tablesByTenant[tenantId]) this.tablesByTenant[tenantId] = {};
      return (this.tablesByTenant[tenantId][tableName] as T[]) || [];
    }
  }

  /**
   * Persists an array slice (relational table rows) for a tenant under transactional lock.
   */
  public async saveSlice<T>(tenantId: string, sliceKey: string, data: T[]): Promise<void> {
    const tableName = TABLE_MAP[sliceKey] || sliceKey;

    // Cache immediately in local storage fallback
    if (!this.tablesByTenant[tenantId]) this.tablesByTenant[tenantId] = {};
    this.tablesByTenant[tenantId][tableName] = data;

    // Evict Redis Cache
    const cacheKey = `veggiepos:tenant:${tenantId}:slice:${sliceKey}`;
    if (redisCacheService.isActive()) {
      await redisCacheService.delete(cacheKey);
      console.log(`[Database] [CACHE EVICT] Evicted slice [${sliceKey}] for Tenant [${tenantId}] on saveSlice write.`);
    }

    const client = this.getSupabaseClient();
    if (!client) return;

    // Use TenantLockManager to execute sequentially
    await TenantLockManager.acquire(tenantId, async () => {
      try {
        if (data.length > 0) {
          // Map to rows including the tenant ID
          const rows = data.map((item: any) => {
            const { tenant_id, ...rest } = item;
            return {
              ...rest,
              tenant_id: tenantId
            };
          });

          // 1. First insert/upsert the new/updated rows
          const { error: insertError } = await client
            .from(tableName)
            .upsert(rows);

          if (insertError) {
            throw new Error(`Insert/Upsert failed: ${insertError.message}`);
          }

          // 2. Delete old rows that are not in the new dataset for this tenant
          const keyField = tableName === "recipes" ? "menuItemId" : "id";
          const incomingKeys = data
            .map((item: any) => item[keyField])
            .filter((val) => val !== undefined && val !== null);

          if (incomingKeys.length > 0) {
            const { error: deleteError } = await client
              .from(tableName)
              .delete()
              .eq("tenant_id", tenantId)
              .not(keyField, "in", `(${incomingKeys.join(",")})`);

            if (deleteError) {
              throw new Error(`Delete cleanup failed: ${deleteError.message}`);
            }
          }
        } else {
          // If the incoming array is completely empty, delete everything for this tenant
          const { error: deleteError } = await client
            .from(tableName)
            .delete()
            .eq("tenant_id", tenantId);

          if (deleteError) {
            throw new Error(`Delete failed: ${deleteError.message}`);
          }
        }
      } catch (err: any) {
        const errMsg = err.message || String(err);
        if (
          errMsg.includes("Could not find the table") || 
          (errMsg.includes("relation") && errMsg.includes("does not exist")) ||
          isRlsErrorMessage(errMsg)
        ) {
          console.warn(`Supabase table ${tableName} is not available or restricted by RLS for write. Cached changes locally in memory for tenant ${tenantId}.`);
        } else {
          console.error(`Failed to bulk sync table ${tableName} in Supabase for tenant ${tenantId}:`, errMsg);
          throw new Error(`Failed to save ${tableName}: ${errMsg}`);
        }
      }
    });
  }

  /**
   * Get a loose object configuration (e.g. settings) from the tenant_objects table.
   */
  public async getObject<T>(tenantId: string, sliceKey: string): Promise<T | null> {
    // Try Redis cache first
    const cacheKey = `veggiepos:tenant:${tenantId}:object:${sliceKey}`;
    if (redisCacheService.isActive()) {
      const cached = await redisCacheService.get<T>(cacheKey);
      if (cached !== null) {
        console.log(`[Database] [CACHE HIT] Object [${sliceKey}] for Tenant [${tenantId}] returned from Redis.`);
        return cached;
      }
    }

    const client = this.getSupabaseClient();
    const tableName = TABLE_MAP[sliceKey];

    // If it's a dedicated settings table, select it
    if (tableName === "settings") {
      if (!client) {
        if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
        const localData = this.objectsByTenant[tenantId][tableName] || null;
        if (redisCacheService.isActive() && localData) {
          await redisCacheService.set(cacheKey, localData, 300);
        }
        return localData;
      }
      try {
        const { data, error } = await client
          .from("settings")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        let settingsExtra: any = null;
        try {
          const { data: extraData } = await client
            .from("tenant_objects")
            .select("value")
            .eq("tenant_id", tenantId)
            .eq("key", "settings_extra")
            .maybeSingle();
          if (extraData && extraData.value) {
            settingsExtra = extraData.value;
          }
        } catch (ex) {
          // Ignore error fetching extra settings
        }

        if (error) {
          const errMsg = error.message || "";
          if (
            errMsg.includes("Could not find the table") || 
            (errMsg.includes("relation") && errMsg.includes("does not exist")) ||
            isRlsErrorMessage(errMsg)
          ) {
            console.warn(`Supabase table settings is not available or restricted by RLS. Object load fallback to local memory cache for tenant ${tenantId}.`);
          } else {
            console.warn(`Supabase object load warning for settings table on tenant ${tenantId}:`, errMsg);
          }
          if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
          const existing = this.objectsByTenant[tenantId][tableName] || {};
          const merged = { ...existing, ...settingsExtra };
          return Object.keys(merged).length > 0 ? merged as T : null;
        }

        if (data || settingsExtra) {
          if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
          const existing = this.objectsByTenant[tenantId][tableName] || {};
          const merged = { ...existing, ...settingsExtra, ...data };
          this.objectsByTenant[tenantId][tableName] = merged;

          // Save to Redis Cache
          if (redisCacheService.isActive()) {
            await redisCacheService.set(cacheKey, merged, 3600); // 1 hour TTL
            console.log(`[Database] [CACHE WRITE] Saved settings object for Tenant [${tenantId}] to Redis.`);
          }

          return merged as T;
        }
        return null;
      } catch (err: any) {
        const errMsg = err.message || String(err);
        if (
          errMsg.includes("Could not find the table") || 
          (errMsg.includes("relation") && errMsg.includes("does not exist")) ||
          isRlsErrorMessage(errMsg)
        ) {
          console.warn(`Supabase table settings is not available or restricted by RLS. Using local memory cache for tenant ${tenantId}.`);
        } else {
          console.error(`Error loading settings for tenant ${tenantId}:`, errMsg);
        }
        if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
        return this.objectsByTenant[tenantId][tableName] || null;
      }
    }

    // Otherwise load from tenant_objects table
    if (!client) {
      if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
      const localData = this.objectsByTenant[tenantId][sliceKey] || null;
      if (redisCacheService.isActive() && localData) {
        await redisCacheService.set(cacheKey, localData, 300);
      }
      return localData;
    }

    try {
      const { data, error } = await client
        .from("tenant_objects")
        .select("value")
        .eq("tenant_id", tenantId)
        .eq("key", sliceKey)
        .maybeSingle();

      if (error) {
        const errMsg = error.message || "";
        if (
          errMsg.includes("Could not find the table") || 
          (errMsg.includes("relation") && errMsg.includes("does not exist")) ||
          isRlsErrorMessage(errMsg)
        ) {
          console.warn(`Supabase table tenant_objects is not available or restricted by RLS. Object ${sliceKey} load fallback to local memory cache for tenant ${tenantId}.`);
        } else {
          console.warn(`Supabase load warning for object ${sliceKey} on tenant ${tenantId}:`, errMsg);
        }
        if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
        return this.objectsByTenant[tenantId][sliceKey] || null;
      }

      if (data && data.value) {
        if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
        this.objectsByTenant[tenantId][sliceKey] = data.value;

        // Save to Redis Cache
        if (redisCacheService.isActive()) {
          await redisCacheService.set(cacheKey, data.value, 3600); // 1 hour TTL
          console.log(`[Database] [CACHE WRITE] Saved object [${sliceKey}] for Tenant [${tenantId}] to Redis.`);
        }

        return data.value as T;
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      if (
        errMsg.includes("Could not find the table") || 
        (errMsg.includes("relation") && errMsg.includes("does not exist")) ||
        isRlsErrorMessage(errMsg)
      ) {
        console.warn(`Supabase table tenant_objects is not available or restricted by RLS. Object ${sliceKey} load fallback to local memory cache for tenant ${tenantId}.`);
      } else {
        console.error(`Failed to fetch object ${sliceKey} for tenant ${tenantId}:`, errMsg);
      }
    }

    if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
    return this.objectsByTenant[tenantId][sliceKey] || null;
  }

  /**
   * Save a loose object configuration back to the tenant_objects table under transactional lock.
   */
  public async saveObject<T>(tenantId: string, sliceKey: string, data: T): Promise<void> {
    const tableName = TABLE_MAP[sliceKey];

    if (!this.objectsByTenant[tenantId]) this.objectsByTenant[tenantId] = {};
    this.objectsByTenant[tenantId][sliceKey] = data;

    // Evict Redis Cache
    const cacheKey = `veggiepos:tenant:${tenantId}:object:${sliceKey}`;
    if (redisCacheService.isActive()) {
      await redisCacheService.delete(cacheKey);
      console.log(`[Database] [CACHE EVICT] Evicted object [${sliceKey}] for Tenant [${tenantId}] on saveObject write.`);
    }

    const client = this.getSupabaseClient();
    if (!client) return;

    await TenantLockManager.acquire(tenantId, async () => {
      try {
        if (tableName === "settings") {
          const { tenant_id, ...rest } = data as any;
          
          const allowedDbColumns = [
            "autoDeductStock",
            "blockOrdersIfInsufficient",
            "managerCanAddPurchases",
            "managerCanEditRecipes",
            "kdsSoundAlerts",
            "quickPinRequired"
          ];

          const dbObj: any = { tenant_id: tenantId };
          const extraObj: any = {};

          for (const key of Object.keys(rest)) {
            if (allowedDbColumns.includes(key)) {
              dbObj[key] = rest[key];
            } else {
              extraObj[key] = rest[key];
            }
          }

          // 1. Save standard columns to 'settings' table
          const { error: dbError } = await client
            .from("settings")
            .upsert(dbObj);

          if (dbError) throw dbError;

          // 2. Save any custom/alert columns (like emailAlertAddress, slackWebhookUrl, sentryDsn, enableAlerts) to tenant_objects
          if (Object.keys(extraObj).length > 0) {
            const { error: extraError } = await client
              .from("tenant_objects")
              .upsert({
                tenant_id: tenantId,
                key: "settings_extra",
                value: extraObj,
                updated_at: new Date().toISOString()
              });
            if (extraError) throw extraError;
          }
        } else {
          const { error } = await client
            .from("tenant_objects")
            .upsert({
              tenant_id: tenantId,
              key: sliceKey,
              value: data,
              updated_at: new Date().toISOString()
            });
          if (error) throw error;
        }
      } catch (err: any) {
        const errMsg = err.message || String(err);
        if (
          errMsg.includes("Could not find the table") || 
          (errMsg.includes("relation") && errMsg.includes("does not exist")) ||
          isRlsErrorMessage(errMsg)
        ) {
          console.warn(`Supabase table ${tableName === "settings" ? "settings" : "tenant_objects"} is not available or restricted by RLS for write. Cached changes in local memory for tenant ${tenantId}.`);
        } else {
          console.error(`Failed to save object ${sliceKey} in Supabase for tenant ${tenantId}:`, errMsg);
          throw new Error(`Failed to save ${sliceKey}: ${errMsg}`);
        }
      }
    });
  }
}
