import crypto from 'node:crypto';
export function verifyCashfreeSignature(raw:Buffer,signature:string,timestamp:string,secret:string):boolean {
 if(!secret || !/^\d{10,16}$/.test(timestamp || '') || !signature || !Buffer.isBuffer(raw)) return false;
 const expected=crypto.createHmac('sha256',secret).update(timestamp).update(raw).digest();
 const actual=Buffer.from(signature,'base64');return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
}
export interface CashfreeGateway {
 create(input:any):Promise<any>;
 get(id:string):Promise<any>;
 cancel(id:string):Promise<any>;
 orders(id:string):Promise<any>;
 payments(orderId:string):Promise<any>;
 refunds(orderId:string):Promise<any>;
}
export class CashfreeClient implements CashfreeGateway {
 private async request(path:string,method='GET',body?:any) {
  const mode=process.env.CASHFREE_ENV,app=process.env.CASHFREE_APP_ID,secret=process.env.CASHFREE_SECRET_KEY;
  if(!['sandbox','production'].includes(mode) || !app || !secret) throw Object.assign(new Error('Cashfree is not configured. Contact the service owner.'),{status:503,code:'PAYMENT_GATEWAY_UNAVAILABLE'});
  const base=mode==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','x-client-id':app,'x-client-secret':secret,'x-api-version':'2025-01-01'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(r.status===404) throw Object.assign(new Error("Cashfree payment link was not found."),{status:404,code:"CASHFREE_NOT_FOUND"});
  if(!r.ok) throw Object.assign(new Error('Cashfree could not verify the request. Please retry or check payment status.'),{status:503,code:'CASHFREE_UNAVAILABLE'});
  return r.json();
 }
 create(input:any){return this.request('/links','POST',input);}
 get(id:string){return this.request(`/links/${encodeURIComponent(id)}`);}
 cancel(id:string){return this.request(`/links/${encodeURIComponent(id)}/cancel`,'POST');}
 orders(id:string){return this.request(`/links/${encodeURIComponent(id)}/orders`);}
 payments(id:string){return this.request(`/orders/${encodeURIComponent(id)}/payments`);}
 refunds(id:string){return this.request(`/orders/${encodeURIComponent(id)}/refunds`);}
}
