import crypto from 'node:crypto';
import {Database} from '../shared/database';
import {PLAN_LIMITS} from '../../../shared/planCatalog';
import {CashfreeClient,type CashfreeGateway} from './CashfreeClient';
import {activatePaidPlan,flagFinancialReview,getSubscription,entitlementError} from './SubscriptionLifecycle';
const db=()=>Database.getInstance();
export interface PaymentLink {
 id:string;tenantId:string;plan:'pro'|'enterprise';amount:number;requestId:string;createdAt:string;expiresAt:string;
 status:string;url?:string;activated?:boolean;orderIds?:string[];reversed?:boolean;
}
const fail=(code:string,message:string,status=409)=>Object.assign(new Error(message),{code,status});
const load=async(tenant:string)=>(await db().getObject<Record<string,PaymentLink>>(tenant,'cashfree_links')) || {};
export async function listPaymentLinks(tenant:string){return Object.values(await load(tenant)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
async function indexLink(link:PaymentLink) {
 await db().runTransaction('saas-admin',async()=>{
  await db().saveObject('saas-admin',`cashfree_link:${link.id}`,{restaurantId:link.tenantId});
  const all=await db().getObject<{tenantId:string;id:string}[]>('saas-admin','cashfree_link_index') || [];
  if(!all.some(l=>l.id===link.id)) await db().saveObject('saas-admin','cashfree_link_index',[...all,{id:link.id,tenantId:link.tenantId}]);
 });
}
export async function createPaymentLink(tenant:string,plan:'pro'|'enterprise',requestId:string,customer:{name:string;email:string;phone:string},gateway:CashfreeGateway=new CashfreeClient()):Promise<PaymentLink> {
 if(!['pro','enterprise'].includes(plan) || !/^[\w-]{8,100}$/.test(requestId)) throw fail('INVALID_CHECKOUT','Invalid plan or request identifier.',400);
 if(!customer || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) || !/^[6-9]\d{9}$/.test(customer.phone) || typeof customer.name!=='string' || !customer.name.trim() || customer.name.length>100) throw fail('INVALID_CUSTOMER','Enter a valid name, email and Indian mobile number.',400);
 const sub=await getSubscription(tenant);if(sub.financialReview) throw entitlementError('FINANCIAL_REVIEW','Contact support to resolve Financial Review before paying again.');
 // First reconcile/cancel all prior pending links outside CAS retries. A stale concurrent
 // creator is fenced below by the active intent pointer and cannot create a second link.
 const prior=Object.values(await load(tenant)).find(l=>['ACTIVE','CREATING','CANCEL_PENDING'].includes(l.status) && l.requestId!==requestId);
 if(prior){
  if(prior.status==='CREATING') throw fail('CHECKOUT_IN_PROGRESS','A checkout is being recovered. Check its payment status before creating another link.');
  const current=await reconcilePayment(tenant,prior.id,gateway);
  if(current.status==='PAID') throw fail('PAYMENT_ALREADY_RECEIVED','Payment was received. Refresh your subscription before choosing another plan.');
  if(current.status==='ACTIVE') {
   await db().runTransaction(tenant,async()=>{const all=await load(tenant);if(all[prior.id]?.status==='ACTIVE'){all[prior.id].status='CANCEL_PENDING';await db().saveObject(tenant,'cashfree_links',all);}});
   const cancelled=await gateway.cancel(prior.id);
   if(!['CANCELLED','EXPIRED'].includes(cancelled.link_status)) throw fail('LINK_CANCEL_UNCONFIRMED','Previous link cancellation is not confirmed. Check payment status.');
   await db().runTransaction(tenant,async()=>{const all=await load(tenant);if(all[prior.id].status!=='PAID') all[prior.id].status=cancelled.link_status;await db().saveObject(tenant,'cashfree_links',all);});
  }
 }
 const candidateId=`aat_${crypto.randomBytes(16).toString('hex')}`;
 const link=await db().runTransaction(tenant,async()=>{
  if((await getSubscription(tenant)).financialReview) throw entitlementError('FINANCIAL_REVIEW','Resolve Financial Review before paying again.');
  const all=await load(tenant),same=Object.values(all).find(l=>l.requestId===requestId);
  if(same){if(same.plan!==plan) throw fail('IDEMPOTENCY_CONFLICT','This request identifier was used for another plan.');return same;}
  if(Object.values(all).some(l=>['CREATING','ACTIVE','CANCEL_PENDING'].includes(l.status))) throw fail('CHECKOUT_IN_PROGRESS','An existing checkout must finish or be cancelled first.');
  const createdAt=new Date().toISOString();const next:PaymentLink={id:candidateId,tenantId:tenant,plan,amount:PLAN_LIMITS[plan].price,requestId,createdAt,expiresAt:new Date(Date.now()+3600000).toISOString(),status:'CREATING'};
  all[next.id]=next;await db().saveObject(tenant,'cashfree_links',all);return next;
 });
 if(link.status!=='CREATING') return link;
 if(Date.parse(link.expiresAt)<=Date.now()) throw fail('LINK_EXPIRED','This checkout intent expired. Check its status before starting another.');
 await indexLink(link);
 const appUrl=process.env.APP_URL;
 if(appUrl && !/^https:\/\//.test(appUrl)) throw fail('APP_URL_INVALID','A secure app URL is required for payment return links.',503);
 let response:any;
 try {
  response=await gateway.create({link_id:link.id,link_amount:link.amount,link_currency:'INR',link_partial_payments:false,link_expiry_time:link.expiresAt,
   link_purpose:`Aatmyam POS ${PLAN_LIMITS[plan].label} — 30 days`,customer_details:{customer_name:customer.name,customer_email:customer.email,customer_phone:customer.phone},
   link_notify:{send_email:false,send_sms:false},link_auto_reminders:false,
   ...(appUrl?{link_meta:{return_url:`${appUrl.replace(/\/$/,'')}/?tab=settings&checkout=return`,notify_url:`${appUrl.replace(/\/$/,'')}/api/webhooks/cashfree`}}:{}),link_notes:{tenant_id:tenant,plan}});
 } catch(error) {
  // Creation may have succeeded before the connection failed. Recover the same ID.
  // Never issue a second ID or retry a financial side effect inside a transaction.
  try {response=await gateway.get(link.id);}catch{throw error;}
  if(!response || response.link_id!==link.id) throw error;
 }
 if(response.link_id!==link.id || Number(response.link_amount)!==link.amount || response.link_currency!=='INR' || !['ACTIVE','PAID'].includes(response.link_status)) throw fail('PAYMENT_MISMATCH','Cashfree returned a mismatched link. Check payment status.');
 if(typeof response.link_url!=='string' || !/^https:\/\/(payments(?:-test)?\.cashfree\.com|sandbox\.cashfree\.com)\//.test(response.link_url)) throw fail('INVALID_CHECKOUT_URL','Cashfree returned an unrecognized checkout URL.');
 await db().runTransaction(tenant,async()=>{const all=await load(tenant);const current=all[link.id];if(current.status==='CREATING'){current.status=response.link_status;current.url=response.link_url;}await db().saveObject(tenant,'cashfree_links',all);});
 if(response.link_status==='PAID') return reconcilePayment(tenant,link.id,gateway);
 return (await load(tenant))[link.id];
}
export async function reconcilePayment(tenant:string,id:string,gateway:CashfreeGateway=new CashfreeClient()):Promise<PaymentLink> {
 const stored=(await load(tenant))[id];if(!stored) throw fail('NOT_FOUND','Payment link not found.',404);
 let provider:any;
 try{provider=await gateway.get(id);}catch(error){
  if((error as any).code==='CASHFREE_NOT_FOUND' && stored.status==='CREATING' && Date.now()>=Date.parse(stored.expiresAt)) {
   return db().runTransaction(tenant,async()=>{const all=await load(tenant);if(all[id].status==='CREATING')all[id].status='EXPIRED';await db().saveObject(tenant,'cashfree_links',all);return all[id];});
  }
  throw error;
 }
 if(provider.link_id!==id || provider.link_currency!=='INR' || Number(provider.link_amount)!==stored.amount) throw fail('PAYMENT_MISMATCH','Payment amount or currency does not match the server invoice.');
 let paidAt:string,paidOrder:any;
 if(provider.link_status==='PAID') {
  if(Number(provider.link_amount_paid)!==stored.amount) throw fail('PAYMENT_MISMATCH','Cashfree has not confirmed the full invoice amount.');
  const result=await gateway.orders(id),orders=Array.isArray(result)?result:result?.orders;
  paidOrder=orders?.find((o:any)=>o.order_status==='PAID' && Number(o.order_amount)===stored.amount && o.order_currency==='INR');
  if(!paidOrder?.order_id) throw fail('PAYMENT_MISMATCH','No matching paid Cashfree order was found.');
  const payments=await gateway.payments(paidOrder.order_id);
  const payment=Array.isArray(payments)?payments.find(p=>p.payment_status==='SUCCESS' && Number(p.payment_amount)===stored.amount && p.payment_currency==='INR'):null;
  if(!payment || !Number.isFinite(Date.parse(payment.payment_time))) throw fail('PAYMENT_MISMATCH','No successful Cashfree payment with a verified payment time was found.');
  paidAt=new Date(payment.payment_time).toISOString();
  if(Date.parse(paidAt)<Date.parse(stored.createdAt)-60000 || Date.parse(paidAt)>Date.parse(stored.expiresAt)+60000) throw fail('PAYMENT_MISMATCH','Payment time is outside this invoice window. Financial review is required.');
  await db().saveObject('saas-admin',`cashfree_order:${paidOrder.order_id}`,{restaurantId:tenant,linkId:id});
  const refunds=await gateway.refunds(paidOrder.order_id);
  if(!Array.isArray(refunds)) throw fail('RECONCILIATION_FAILED','Refund status could not be verified.');
  if(refunds.some(r=>r.refund_status==='SUCCESS')) {
   await reversePayment(tenant,id,'refund');return (await load(tenant))[id];
  }
 }
 return db().runTransaction(tenant,async()=>{
  const all=await load(tenant),current=all[id];
  // Signed reversal/Financial Review always dominates any stale success read.
  if(current.reversed || (await getSubscription(tenant)).financialReview) return current;
  if(provider.link_status==='PAID') {
   if(!current.activated) await activatePaidPlan(tenant,current.plan,paidAt,id);
   current.activated=true;current.orderIds=[paidOrder.order_id];current.status='PAID';
  } else if(current.status!=='PAID') {
   if(!['ACTIVE','CANCELLED','EXPIRED','PARTIALLY_PAID'].includes(provider.link_status)) throw fail('RECONCILIATION_FAILED','Unknown Cashfree link status.');
   current.status=provider.link_status;
  }
  await db().saveObject(tenant,'cashfree_links',all);return current;
 });
}
async function reversePayment(tenant:string,id:string,reason:string) {
 await db().runTransaction(tenant,async()=>{const all=await load(tenant);if(!all[id]) throw fail('NOT_FOUND','Unknown payment.',404);
  if(!all[id].reversed){await flagFinancialReview(tenant,id,reason);all[id].reversed=true;all[id].status='FINANCIAL_REVIEW';await db().saveObject(tenant,'cashfree_links',all);}
 });
}
export async function processCashfreeEvent(event:any,eventHash:string,gateway:CashfreeGateway=new CashfreeClient()) {
 if(event?.type==='PAYMENT_LINK_EVENT') {
  const id=event.data?.link_id;const mapping=id?await db().getObject<any>('saas-admin',`cashfree_link:${id}`):null;
  if(!mapping) throw fail('UNKNOWN_PAYMENT','Payment link mapping is not ready; retry required.',503);
  await reconcilePayment(mapping.restaurantId,id,gateway);return;
 }
 const refund=event?.type==='REFUND_STATUS_WEBHOOK' && event.data?.refund?.refund_status==='SUCCESS';
 const dispute=['DISPUTE_CREATED','DISPUTE_UPDATED','DISPUTE_CLOSED'].includes(event?.type);
 if(!refund && !dispute) return;
 const order=refund?event.data.refund.order_id:event.data?.order_details?.order_id;
 const mapping=order?await db().getObject<any>('saas-admin',`cashfree_order:${order}`):null;
 if(!mapping) throw fail('UNKNOWN_PAYMENT','Payment order mapping is not ready; retry required.',503);
 await db().runTransaction(mapping.restaurantId,async()=>{
  if(await db().getObject(mapping.restaurantId,`cashfree_event:${eventHash}`)) return;
  await reversePayment(mapping.restaurantId,mapping.linkId,refund?'refund':'dispute');
  await db().saveObject(mapping.restaurantId,`cashfree_event:${eventHash}`,{processedAt:new Date().toISOString(),type:event.type});
 });
}
export async function reconcileAllPayments() {
 const index=await db().getObject<{tenantId:string;id:string}[]>('saas-admin','cashfree_link_index') || [];
 let failures=0;
 for(const link of index) {try{const record=(await load(link.tenantId))[link.id];if(record && !record.reversed && !['CANCELLED','EXPIRED'].includes(record.status)) await reconcilePayment(link.tenantId,link.id);}catch{failures++;}}
 if(failures) throw new Error(`${failures} Cashfree invoices need reconciliation retry.`);
 return index.length;
}
