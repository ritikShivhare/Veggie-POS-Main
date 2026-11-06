import { Request,Response,NextFunction } from 'express';
import { Database,handleApiError } from '../features/shared/database';
import { IdempotencyService,computeRequestHash,IdempotencyPayloadMismatchError } from '../features/shared/IdempotencyService';
const service=IdempotencyService.getInstance();
/** The command and its response receipt commit in the SAME PostgreSQL transaction.
 * A failed command is rolled back and can be retried. Path/method are fingerprinted.
 */
export async function idempotencyMiddleware(req:Request,res:Response,next:NextFunction) {
  const rawKey=req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if(!rawKey) return next();
  const key=String(rawKey).trim();
  if(!key || key.length>255) return res.status(400).json({success:false,error:'INVALID_IDEMPOTENCY_KEY'});
  const tenantId=(req as any).tenantId;
  if(!tenantId) return res.status(401).json({success:false,error:'UNAUTHORIZED'});
  const hash=computeRequestHash(req.body), path=(req.originalUrl || req.path).split('?')[0], method=req.method;
  const originalJson=res.json;
  let response:{status:number,body:any}|undefined;
  try {
    if(service.isInFlight(tenantId,key)) await service.waitForInFlight(tenantId,key);
    response=await Database.getInstance().runTransaction(tenantId,async()=>{
      const existing=await service.getRecord(tenantId,key);
      if(existing?.status==='COMPLETED') {
        if((existing.request_hash && existing.request_hash!==hash) || (existing.request_path && existing.request_path!==path) || (existing.request_method && existing.request_method!==method)) throw new IdempotencyPayloadMismatchError();
        res.setHeader('Idempotent-Replayed','true'); return {status:existing.status_code,body:existing.response_body};
      }
      const captured=await new Promise<{status:number,body:any}>((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(Object.assign(new Error('Command timed out; retry safely.'),{status:503,code:'COMMAND_TIMEOUT'})),30000);
        res.json=((body:any)=>{clearTimeout(timeout);resolve({status:res.statusCode || 200,body});return res;}) as any;
        try {next();} catch(error) {clearTimeout(timeout);reject(error);}
      });
      response=captured;
      if(captured.status>=400 || captured.body?.success===false) throw Object.assign(new Error('Command rejected.'),{commandResponse:captured});
      await service.saveRecord({tenant_id:tenantId,idempotency_key:key,status_code:captured.status,response_body:captured.body,request_hash:hash,request_path:path,request_method:method,status:'COMPLETED'});
      return captured;
    },{retry:false});
    res.json=originalJson; res.setHeader('Idempotency-Key',key); return res.status(response.status).json(response.body);
  } catch(error:any) {
    res.json=originalJson;
    if(error.commandResponse) return res.status(error.commandResponse.status).json(error.commandResponse.body);
    return handleApiError(res,error);
  }
}
