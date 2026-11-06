import crypto from 'node:crypto';
import { Database } from './database';
export interface IdempotencyRecord {
  id:string; tenant_id:string; idempotency_key:string; status_code:number; response_body:any;
  request_path?:string; request_method?:string; request_hash?:string;
  status?:'PROCESSING'|'COMPLETED'|'FAILED'; expires_at?:string; created_at?:string;
}
export class IdempotencyConflictError extends Error { code='IDEMPOTENCY_CONFLICT'; statusCode=409; constructor(message='A request with this key is still processing.') {super(message);} }
export class IdempotencyPayloadMismatchError extends Error { code='IDEMPOTENCY_KEY_PAYLOAD_MISMATCH'; statusCode=422; constructor(message='This key belongs to a different request.') {super(message);} }
export function canonicalJsonStringify(obj:any):string {
  if (obj===null || obj===undefined) return 'null';
  if (typeof obj!=='object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '['+obj.map(canonicalJsonStringify).join(',')+']';
  return '{'+Object.keys(obj).sort().map(k=>JSON.stringify(k)+':'+canonicalJsonStringify(obj[k])).join(',')+'}';
}
export function computeRequestHash(body:any):string {return crypto.createHash('sha256').update(canonicalJsonStringify(body)).digest('hex');}
export class IdempotencyService {
  private static instance:IdempotencyService;
  private inFlightRequests=new Map<string,{promise:Promise<IdempotencyRecord|null>,resolve:(r:IdempotencyRecord|null)=>void}>();
  static getInstance() {return this.instance ||= new IdempotencyService();}
  getCompositeKey(t:string,k:string) {return `${t}::${k}`;}
  private objectKey(k:string) {return 'command:'+computeRequestHash(k);}
  isInFlight(t:string,k:string) {return this.inFlightRequests.has(this.getCompositeKey(t,k));}
  startInFlight(t:string,k:string) {
    const key=this.getCompositeKey(t,k); if(this.inFlightRequests.has(key)) return;
    let resolve!:(r:IdempotencyRecord|null)=>void;
    const promise=new Promise<IdempotencyRecord|null>(r=>resolve=r); this.inFlightRequests.set(key,{promise,resolve});
  }
  async waitForInFlight(t:string,k:string) {return this.inFlightRequests.get(this.getCompositeKey(t,k))?.promise || this.getRecord(t,k);}
  abortInFlight(t:string,k:string,_error?:any) {const key=this.getCompositeKey(t,k);this.inFlightRequests.get(key)?.resolve(null);this.inFlightRequests.delete(key);}
  async getRecord(t:string,k:string):Promise<IdempotencyRecord|null> {return Database.getInstance().getObject(t,this.objectKey(k));}
  async saveRecord(record:Omit<IdempotencyRecord,'id'>&{id?:string}):Promise<IdempotencyRecord> {
    const db=Database.getInstance();
    const result=await db.runTransaction(record.tenant_id,async trx=>{
      const existing=await this.getRecord(record.tenant_id,record.idempotency_key);
      if(existing?.status==='COMPLETED') {
        if(record.request_hash && existing.request_hash && record.request_hash!==existing.request_hash) throw new IdempotencyPayloadMismatchError();
        return existing;
      }
      const final={...existing,...record,id:record.id || existing?.id || crypto.randomUUID(),status:record.status || 'COMPLETED',created_at:record.created_at || new Date().toISOString()} as IdempotencyRecord;
      await trx.saveObject(this.objectKey(record.idempotency_key),final);return final;
    });
    const key=this.getCompositeKey(record.tenant_id,record.idempotency_key);
    this.inFlightRequests.get(key)?.resolve(result); this.inFlightRequests.delete(key); return result;
  }
  // Compatibility for callers reserving work. Mutations use the transaction-based
  // middleware below so their business result and receipt are committed together.
  async reserveOrGetRecord(t:string,k:string,hash?:string,path?:string,method?:string):Promise<any> {
    return Database.getInstance().runTransaction(t,async()=>{
      const existing=await this.getRecord(t,k);
      if(existing?.request_hash && hash && existing.request_hash!==hash) throw new IdempotencyPayloadMismatchError();
      if(existing?.status==='COMPLETED') return {status:'COMPLETED',record:existing};
      if(existing && (!existing.expires_at || Date.parse(existing.expires_at)>Date.now())) return {status:'PROCESSING',record:existing};
      await this.saveRecord({tenant_id:t,idempotency_key:k,status_code:0,response_body:null,status:'PROCESSING',request_hash:hash,request_path:path,request_method:method,expires_at:new Date(Date.now()+60000).toISOString()});
      this.startInFlight(t,k); return {status:'RESERVED'};
    });
  }
  clearMemory() {
    for(const pending of this.inFlightRequests.values()) pending.resolve(null); this.inFlightRequests.clear();
    if(process.env.VITEST) for(const objects of Object.values((Database.getInstance() as any).objectsByTenant) as any[]) for(const key of Object.keys(objects)) if(key.startsWith('command:')) delete objects[key];
  }
}
