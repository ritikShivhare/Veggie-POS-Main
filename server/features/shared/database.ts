import { createClient } from "@supabase/supabase-js";
import { AsyncLocalStorage } from "node:async_hooks";
import { TABLE_MAP, tableFor, idFor, toDatabaseRow, fromDatabaseRow } from "./schema";

interface TransactionState {
  tenantId: string;
  slices: Map<string, any[]>;
  objects: Map<string, any>;
  reads: Map<string, any>;
  rolledBack: boolean;
  trx: DatabaseTransaction;
  afterCommit: (() => void)[];
}
const transactions = new AsyncLocalStorage<TransactionState>();
const locks = new Map<string, Promise<unknown>>();
const clone = <T>(value: T): T => value == null ? value : structuredClone(value);

export class DatabaseUnavailableError extends Error {
  public code = "DATABASE_UNAVAILABLE";
  public status = 503;
  public statusCode = 503;

  constructor(message: string = "Database is unavailable. Writes cannot be committed.") {
    super(message);
    this.name = "DatabaseUnavailableError";
    Object.setPrototypeOf(this, DatabaseUnavailableError.prototype);
  }
}

export class OptimisticLockConflictError extends Error {
  public code = "OPTIMISTIC_LOCK_CONFLICT";
  public status = 409;
  public statusCode = 409;
  public entityId?: string;
  public expectedVersion?: number;
  public currentVersion?: number;

  constructor(
    message: string = "Optimistic lock conflict: stale update rejected.",
    details?: { entityId?: string; expectedVersion?: number; currentVersion?: number }
  ) {
    super(message);
    this.name = "OptimisticLockConflictError";
    this.status = 409;
    this.statusCode = 409;
    this.code = "OPTIMISTIC_LOCK_CONFLICT";
    if (details) {
      this.entityId = details.entityId;
      this.expectedVersion = details.expectedVersion;
      this.currentVersion = details.currentVersion;
    }
    Object.setPrototypeOf(this, OptimisticLockConflictError.prototype);
  }
}

export class TransactionRollbackError extends Error {
  public code = "TRANSACTION_ROLLBACK";
  public status = 400;
  public statusCode = 400;

  constructor(message: string = "Transaction was rolled back.") {
    super(message);
    this.name = "TransactionRollbackError";
    this.status = 400;
    this.statusCode = 400;
    this.code = "TRANSACTION_ROLLBACK";
    Object.setPrototypeOf(this, TransactionRollbackError.prototype);
  }
}

export class CrossTenantViolationError extends Error {
  public code = "CROSS_TENANT_VIOLATION";
  public status = 403;
  public statusCode = 403;

  constructor(message: string = "Database security violation: cross-tenant access forbidden by database policy.") {
    super(message);
    this.name = "CrossTenantViolationError";
    this.status = 403;
    this.statusCode = 403;
    this.code = "CROSS_TENANT_VIOLATION";
    Object.setPrototypeOf(this, CrossTenantViolationError.prototype);
  }
}

export class NotFoundError extends Error {
  public code = "NOT_FOUND";
  public status = 404;
  public statusCode = 404;

  constructor(message: string = "Requested resource not found.") {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
    this.statusCode = 404;
    this.code = "NOT_FOUND";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export interface DatabaseTransaction {
  tenantId: string;
  saveSlice<T>(sliceKey: string, data: T[]): Promise<void>;
  saveObject<T>(key: string, data: T): Promise<void>;
  rollback(): Promise<void>;
}

function isProductionEnvironment(): boolean {
  const env = (process.env.NODE_ENV || "").trim().toLowerCase();
  const appEnv = (process.env.APP_ENV || "").trim().toLowerCase();
  return env === "production" || appEnv === "production";
}

function sanitizeErrorMessage(rawMessage: string | undefined, status: number): string {
  const isProduction = isProductionEnvironment();
  if (!rawMessage || typeof rawMessage !== "string") {
    return isProduction && status >= 500 ? "An internal server error occurred." : "An unexpected error occurred.";
  }
  if (isProduction && status >= 500) {
    return "An internal server error occurred.";
  }
  let cleaned = rawMessage
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DB_URI]")
    .replace(/redis:\/\/[^\s"']+/gi, "[REDACTED_CACHE_URI]")
    .replace(/(?:password|secret|token|apikey|anon_key|service_role)=['"]?[^'"\s&]+/gi, "$1=[REDACTED]")
    .replace(/bearer\s+[A-Za-z0-9-_=.]+/gi, "Bearer [REDACTED]");
  if (isProduction && (cleaned.includes("\n") || cleaned.includes("    at "))) {
    cleaned = cleaned.split("\n")[0].trim();
  }
  return cleaned;
}

export function handleApiError(res: any, error: any, defaultMessage?: string) {
  if (error?.code === "PLAN_LIMIT_EXCEEDED") {
    return res.status(403).json({success: false, error: "PLAN_LIMIT_EXCEEDED", message: error.message});
  }
  if (
    error?.code === "NOT_FOUND" ||
    error?.status === 404 ||
    error?.statusCode === 404 ||
    error instanceof NotFoundError
  ) {
    return res.status(404).json({
      success: false,
      error: "NOT_FOUND",
      message: error.message || defaultMessage || "Requested resource not found."
    });
  }
  if (
    error?.code === "CROSS_TENANT_VIOLATION" ||
    error?.status === 403 ||
    error?.statusCode === 403 ||
    error instanceof CrossTenantViolationError
  ) {
    return res.status(403).json({
      success: false,
      error: "CROSS_TENANT_VIOLATION",
      message: error.message || defaultMessage || "Database security violation: cross-tenant access forbidden by database policy."
    });
  }
  if (
    error?.code === "TRANSACTION_ROLLBACK" ||
    error instanceof TransactionRollbackError
  ) {
    return res.status(400).json({
      success: false,
      error: "TRANSACTION_ROLLBACK",
      message: error.message || defaultMessage || "Transaction was rolled back."
    });
  }
  if (
    error?.code === "OPTIMISTIC_LOCK_CONFLICT" ||
    error?.status === 409 ||
    error?.statusCode === 409 ||
    error instanceof OptimisticLockConflictError
  ) {
    return res.status(409).json({
      success: false,
      error: "OPTIMISTIC_LOCK_CONFLICT",
      message: error.message || defaultMessage || "Optimistic lock conflict: stale updates rejected.",
      entityId: error.entityId,
      expectedVersion: error.expectedVersion,
      currentVersion: error.currentVersion
    });
  }
  if (
    error?.code === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH" ||
    error?.status === 422 ||
    error?.statusCode === 422
  ) {
    return res.status(422).json({
      success: false,
      error: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
      message: error.message || defaultMessage || "Idempotency key was previously used with a different request payload."
    });
  }
  if (
    error?.code === "IDEMPOTENCY_CONFLICT"
  ) {
    return res.status(409).json({
      success: false,
      error: "IDEMPOTENCY_CONFLICT",
      message: error.message || defaultMessage || "A concurrent request with the same idempotency key is currently processing."
    });
  }
  if (
    error?.code === "DATABASE_UNAVAILABLE" ||
    error?.status === 503 ||
    error?.statusCode === 503 ||
    error instanceof DatabaseUnavailableError
  ) {
    return res.status(503).json({
      success: false,
      error: "DATABASE_UNAVAILABLE",
      message: error.message || defaultMessage || "Database is unavailable. Writes cannot be committed."
    });
  }
  const status = typeof error?.status === "number" ? error.status : typeof error?.statusCode === "number" ? error.statusCode : 500;
  return res.status(status).json({
    success: false,
    error: error?.code || error?.name || "INTERNAL_SERVER_ERROR",
    message: sanitizeErrorMessage(error?.message || defaultMessage, status)
  });
}

export class Database {
  private static instance: Database;
  private tablesByTenant: Record<string, Record<string, any[]>> = {};
  private objectsByTenant: Record<string, Record<string, any>> = {};
  private staleSlices = new Set<string>();
  private staleObjects = new Set<string>();
  private supabase: any = null;
  private dbStopped = false;
  private constructor() {}
  static getInstance(): Database { return this.instance ||= new Database(); }
  markSliceStale(t: string, k: string) { this.staleSlices.add(`${t}:${k}`); }
  unmarkSliceStale(t: string, k: string) { this.staleSlices.delete(`${t}:${k}`); }
  isSliceStale(t: string, k: string) { return this.staleSlices.has(`${t}:${k}`); }
  markObjectStale(t: string, k: string) { this.staleObjects.add(`${t}:${k}`); }
  unmarkObjectStale(t: string, k: string) { this.staleObjects.delete(`${t}:${k}`); }
  isObjectStale(t: string, k: string) { return this.staleObjects.has(`${t}:${k}`); }
  stopDatabase() { this.dbStopped = true; }
  resumeDatabase() { this.dbStopped = false; }
  isDatabaseStopped() { return this.dbStopped; }
  getSupabaseClient(_tenantId?: string): any {
    if (this.supabase) return this.supabase;
    if (process.env.VITEST) return null;
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || url.startsWith('YOUR_') || key.startsWith('YOUR_')) return null;
    // Service key stays on the server. Browser-supplied tenant headers are never database authority.
    this.supabase = createClient(url, key, {auth:{persistSession:false, autoRefreshToken:false}});
    return this.supabase;
  }
  private checkAvailable(client: any): void {
    if (this.dbStopped || (!client && isProductionEnvironment())) throw new DatabaseUnavailableError();
  }
  private checkTenant(tenantId: string, data?: any): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.length > 160) throw new CrossTenantViolationError('A valid tenant is required.');
    if (data && ((data.tenant_id && data.tenant_id !== tenantId) || (data.tenantId && data.tenantId !== tenantId))) throw new CrossTenantViolationError();
    const active = transactions.getStore();
    if (active && active.tenantId !== tenantId) throw new CrossTenantViolationError('A transaction cannot cross tenant boundaries.');
  }
  private dbError(error: any): never {
    if (error?.code === 'PT409' || error?.code === '40001' || error?.message?.includes('STALE_TENANT_REVISION')) throw new OptimisticLockConflictError();
    if (error?.code === '42501') throw new CrossTenantViolationError();
    if (['23503','23505','23514','22P02','22003'].includes(error?.code)) throw Object.assign(new Error('Invalid data or conflicting record.'), {code:'INVALID_DATA', status:400});
    throw new DatabaseUnavailableError('Database operation failed. Verify migrations and database availability.');
  }
  async getSlice<T>(tenantId: string, sliceKey: string): Promise<T[] | null> {
    this.checkTenant(tenantId);
    if (!TABLE_MAP[sliceKey]) return []; // Read compatibility; writes require an allowlisted table.
    const table = tableFor(sliceKey), active = transactions.getStore(), readKey = `slice:${table}`;
    if (active?.slices.has(table)) return clone(active.slices.get(table) as T[]);
    if (active?.reads.has(readKey)) return clone(active.reads.get(readKey));
    const client = this.getSupabaseClient(tenantId); this.checkAvailable(client);
    let rows: any[];
    if (!client) rows = this.tablesByTenant[tenantId]?.[table] || [];
    else {
      rows = [];
      // Supabase defaults to a 1,000 row limit. Always page; never interpret a failed read as an empty snapshot.
      for (let offset = 0; ; offset += 500) {
        const {data, error} = await client.from(table).select('*').eq('tenant_id',tenantId).order(idFor(table)).range(offset, offset+499);
        if (error) { this.markSliceStale(tenantId,sliceKey); this.dbError(error); }
        const page = data || []; rows.push(...page.map((r: any) => fromDatabaseRow(table,r)));
        if (page.length < 500) break;
      }
    }
    active?.reads.set(readKey, clone(rows));
    this.unmarkSliceStale(tenantId,sliceKey);
    return clone(rows) as T[];
  }
  async saveSlice<T>(tenantId: string, sliceKey: string, data: T[]): Promise<void> {
    this.checkTenant(tenantId); const table = tableFor(sliceKey);
    if (!Array.isArray(data)) throw Object.assign(new Error('Expected an array.'), {status:400});
    const ids = new Set<string>();
    for (const item of data) {
      this.checkTenant(tenantId,item); const id = String((item as any)?.[idFor(table)] || '');
      if (!id || ids.has(id)) throw Object.assign(new Error('Missing or duplicate record identifier.'), {code:'INVALID_DATA',status:400});
      ids.add(id);
    }
    const active = transactions.getStore();
    if (active) { active.slices.set(table,clone(data)); return; }
    try { await this.runTransaction(tenantId, trx => trx.saveSlice(sliceKey,data)); }
    catch (err) { this.markSliceStale(tenantId,sliceKey); throw err; }
  }
  async updateItem<T>(tenantId: string, sliceKey: string, id: any, updates: T, expectedVersion?: number): Promise<T> {
    this.checkTenant(tenantId,updates);
    return this.runTransaction(tenantId, async trx => {
      const table = tableFor(sliceKey), key = idFor(table);
      const rows = (await this.getSlice<any>(tenantId,sliceKey)) || [];
      const index = rows.findIndex(r => r[key] === id);
      if (index < 0) throw new NotFoundError();
      const previous = rows[index], currentVersion = previous.version || 1;
      const expected = expectedVersion ?? (updates as any)?.version;
      if (expected !== undefined && expected !== currentVersion) throw new OptimisticLockConflictError(undefined,{entityId:String(id),expectedVersion:expected,currentVersion});
      const result = {...previous,...updates,[key]:id,version:currentVersion+1,updated_at:new Date().toISOString()};
      rows[index] = result; await trx.saveSlice(sliceKey,rows); return result as T;
    });
  }
  async getObject<T>(tenantId: string, key: string): Promise<T | null> {
    this.checkTenant(tenantId); const active = transactions.getStore(), readKey = `object:${key}`;
    if (active?.objects.has(key)) return clone(active.objects.get(key));
    if (active?.reads.has(readKey)) return clone(active.reads.get(readKey));
    const client = this.getSupabaseClient(tenantId); this.checkAvailable(client);
    let value: any;
    if (!client) value = this.objectsByTenant[tenantId]?.[key] ?? null;
    else if (key === 'settings') {
      const {data,error} = await client.from('settings').select('data,version,updated_at').eq('tenant_id',tenantId).maybeSingle();
      if (error) {this.markObjectStale(tenantId,key); this.dbError(error);} value = data?.data ? {...data.data,version:data.version,updated_at:data.updated_at} : null;
    } else {
      const {data,error} = await client.from('tenant_objects').select('value').eq('tenant_id',tenantId).eq('key',key).maybeSingle();
      if (error) {this.markObjectStale(tenantId,key); this.dbError(error);} value = data?.value ?? null;
    }
    active?.reads.set(readKey,clone(value)); this.unmarkObjectStale(tenantId,key); return clone(value);
  }
  async saveObject<T>(tenantId: string, key: string, data: T): Promise<void> {
    this.checkTenant(tenantId,data);
    if (!key || key.length > 200) throw Object.assign(new Error('Invalid object key.'),{status:400});
    const active = transactions.getStore();
    if (active) {active.objects.set(key,clone(data)); return;}
    try {await this.runTransaction(tenantId,trx => trx.saveObject(key,data));}
    catch (err) {this.markObjectStale(tenantId,key); throw err;}
  }
  async registerRestaurant(token:string,codeHash:string,tenantId:string,ownerId:string):Promise<any> {
    const client=this.getSupabaseClient();this.checkAvailable(client);
    if(client) {
      const {data,error}=await client.rpc("register_restaurant",{p_token:token,p_code_hash:codeHash,p_tenant_id:tenantId,p_owner_id:ownerId});
      if(error) this.dbError(error);return data;
    }
    return this.runTransaction("saas-admin",async trx=>{
      const challenges=(await this.getObject<any[]>("saas-admin","signup_challenges_v2")) || [];
      const signup=challenges.find(c=>c.pendingToken===token);
      if(!signup || Date.now()>signup.expiresAt) return {success:false,status:400,error:"OTP_EXPIRED"};
      if(signup.attempts>=5) return {success:false,status:429,error:"OTP_ATTEMPTS_EXCEEDED"};
      if(signup.codeHash!==codeHash) {signup.attempts++;await trx.saveObject("signup_challenges_v2",challenges);return {success:false,status:401,error:"INVALID_OTP"};}
      if(signup.registeredTenant) return {success:true,tenant:signup.registeredTenant,ownerId:signup.ownerId};
      const tenant={id:tenantId,tenantId,storeCode:tenantId,name:signup.businessName,status:"active",created:new Date().toISOString().slice(0,10),region:signup.region,ownerName:signup.ownerName,ownerPhone:signup.ownerPhone,email:signup.email};
      signup.registeredTenant=tenant;signup.ownerId=ownerId;await trx.saveObject("signup_challenges_v2",challenges);
      this.afterCommit(()=>{
        this.tablesByTenant[tenantId]={staff:[{id:ownerId,name:signup.ownerName,role:"Owner",pin:signup.pin,passwordHash:signup.passwordHash,permissions:["billing","inventory","reports","settings","staff","orders"],status:"active",version:1}]};
        this.objectsByTenant[tenantId]={settings:{autoDeductStock:true,blockOrdersIfInsufficient:true,managerCanAddPurchases:true,managerCanEditRecipes:true,kdsSoundAlerts:false,quickPinRequired:true,gstPercentage:5}};
        this.objectsByTenant["veg-main-001"] ||= {};const registry=this.objectsByTenant["veg-main-001"]["global_tenants_list"] || [];
        this.objectsByTenant["veg-main-001"]["global_tenants_list"]=[...registry,tenant];
      });
      return {success:true,tenant,ownerId};
    });
  }
  afterCommit(effect:()=>void): boolean {
    const state=transactions.getStore();
    if (!state) return false;
    state.afterCommit.push(effect); return true;
  }
  async runTransaction<R>(tenantId: string, work: (trx: DatabaseTransaction) => Promise<R>, options: {retry?:boolean} = {}): Promise<R> {
    this.checkTenant(tenantId);
    const existing = transactions.getStore();
    if (existing) return work(existing.trx);
    const previous = locks.get(tenantId) || Promise.resolve();
    const task = previous.catch(()=>{}).then(async () => {
      const client = this.getSupabaseClient(tenantId); this.checkAvailable(client);
      // A database revision rejects snapshots computed concurrently on another server. Retrying reruns all calculations.
      for (let attempt = 0; attempt < 4; attempt++) {
        let revision = 0;
        if (client) {
          const {data,error} = await client.rpc('get_tenant_revision',{p_tenant_id:tenantId});
          if (error) this.dbError(error); revision = Number(data || 0);
        }
        const state: TransactionState = {tenantId,slices:new Map(),objects:new Map(),reads:new Map(),rolledBack:false,trx:null as any,afterCommit:[]};
        state.trx = {tenantId,
          saveSlice: (key,data) => this.saveSlice(tenantId,key,data),
          saveObject: (key,data) => this.saveObject(tenantId,key,data),
          rollback: async () => {state.rolledBack=true; throw new TransactionRollbackError();}
        };
        try {
          const result = await transactions.run(state, () => work(state.trx));
          if (state.rolledBack) throw new TransactionRollbackError();
          if (client && (state.slices.size || state.objects.size)) {
            const changes = [...state.slices].map(([table,rows])=>({table,rows:rows.map(r=>toDatabaseRow(table,tenantId,r))}));
            const objects = [...state.objects].map(([key,value])=>({key,value}));
            const {error} = await client.rpc('commit_tenant_transaction',{p_tenant_id:tenantId,p_expected_revision:revision,p_changes:changes,p_objects:objects});
            if (error) this.dbError(error);
          }
          // Nothing touches caches until PostgreSQL confirms the complete commit.
          if (!client) {
            this.tablesByTenant[tenantId] ||= {}; this.objectsByTenant[tenantId] ||= {};
            for (const [table,rows] of state.slices) this.tablesByTenant[tenantId][table]=clone(rows);
            for (const [key,value] of state.objects) this.objectsByTenant[tenantId][key]=clone(value);
          }
          for (const effect of state.afterCommit) {try {effect();} catch { /* An invalidation failure does not roll back committed data. */ }}
          return result;
        } catch (error) {
          if (error instanceof OptimisticLockConflictError && !error.entityId && options.retry !== false && attempt < 3) continue;
          throw error;
        }
      }
      throw new OptimisticLockConflictError();
    });
    const settled = task.catch(()=>{}); locks.set(tenantId,settled);
    try {return await task;} finally {if (locks.get(tenantId)===settled) locks.delete(tenantId);}
  }
}
