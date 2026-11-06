import {isDeepStrictEqual} from 'node:util';
import crypto from 'node:crypto';
import {Database} from '../shared/database';
import type {TenantSubscription} from '../shared/subscription';
import {PLAN_LIMITS,type PlanId} from '../../../shared/planCatalog';
import {isActiveStaff} from '../../../src/features/shared/staffStatus';
const DAY=86400000, CYCLE=30*DAY;
const db=()=>Database.getInstance();
const iso=(n:number)=>new Date(n).toISOString();
export const entitlementError=(code:string,message:string)=>Object.assign(new Error(message),{status:403,code});
export function getPlanLimits(sub:TenantSubscription) {
  return sub.trialEndsAt && Date.parse(sub.trialEndsAt)>Date.now()
    ? {...PLAN_LIMITS.pro,monthlyOrders:250,aiReportsPerDay:5} : {...(PLAN_LIMITS[sub.plan] || PLAN_LIMITS.free),aiReportsPerDay:sub.plan==='free'?0:5};
}
export async function saveSubscription(tenantId:string,sub:TenantSubscription):Promise<void> {
  await db().saveObject(tenantId,'subscription_v1',sub);
}
export async function freezeToFree(tenantId:string,sub:TenantSubscription,deadline:number,trial=false):Promise<TenantSubscription> {
  const orders=await db().getSlice<any>(tenantId,'orders') || [];
  const frozenKots={...(sub.frozenKots || {})};
  if(trial) for(const o of orders.filter(o=>!['Completed','Cancelled'].includes(o.status) && !o.paidAt)) {
    frozenKots[o.id]={total:o.total,items:o.items,settleUntil:iso(deadline+12*3600000)};
  }
  const staff=await db().getSlice<any>(tenantId,'staff') || [];
  const excess=staff.filter(s=>s.role!=='Owner' && isActiveStaff(s)).length>3;
  if(excess) {
    // Stable priority: keep Cashiers, then Managers, then the earliest remaining active staff.
    const priority=(role:string)=>role==='Cashier'?0:role==='Manager'?1:2;
    const retained=new Set(staff.map((s,index)=>({s,index})).filter(({s})=>s.role!=='Owner' && isActiveStaff(s))
      .sort((a,b)=>priority(a.s.role)-priority(b.s.role) || a.index-b.index).slice(0,3).map(({s})=>s.id));
    await db().saveSlice(tenantId,'staff',staff.map(s=>s.role!=='Owner' && isActiveStaff(s) && !retained.has(s.id)?{...s,status:'inactive',version:(s.version || 1)+1}:s));
  }
  if(!sub.inventoryFrozen) await db().saveObject(tenantId,'frozen_inventory_snapshot',{
    frozenAt:iso(deadline),ingredients:await db().getSlice(tenantId,'ingredients'),recipes:await db().getSlice(tenantId,'recipes')
  });
  return {...sub,plan:'free',lastPaidPlan:sub.plan==='free'?sub.lastPaidPlan:sub.plan,status:'active',isReadOnly:false,inventoryFrozen:true,trialEndsAt:undefined,
    cycleStart:iso(deadline),cycleEnd:iso(deadline+CYCLE),frozenKots,staffSelectionRequired:excess || sub.staffSelectionRequired};
}
export async function getSubscription(tenantId:string):Promise<TenantSubscription> {
 return db().runTransaction(tenantId,async()=>{
  let sub=await db().getObject<TenantSubscription>(tenantId,'subscription_v1');
  if(!sub) sub=await db().getObject<TenantSubscription>(tenantId,'stripe_subscription');
  const before=JSON.stringify(sub), now=Date.now();
  const legacy=sub;
  sub={plan:'free',status:'active',isReadOnly:false,inventoryFrozen:!legacy || legacy.plan==='free',...sub};
  if(!PLAN_LIMITS[sub.plan]) sub.plan='free';
  sub.cycleStart ||= iso(now); sub.cycleEnd ||= iso(Date.parse(sub.cycleStart)+CYCLE);
  // Existing paid records receive a bounded migration cycle, never perpetual access.
  if(sub.plan!=='free' && !sub.paidUntil && !sub.trialEndsAt) sub.paidUntil=sub.cycleEnd;
  const expiry=sub.trialEndsAt || (sub.plan!=='free'?sub.paidUntil:undefined);
  if(expiry && now>=Date.parse(expiry)) sub=await freezeToFree(tenantId,sub,Date.parse(expiry),Boolean(sub.trialEndsAt));
  if(!sub.trialEndsAt && now>=Date.parse(sub.cycleEnd)) {
    const steps=Math.floor((now-Date.parse(sub.cycleStart))/CYCLE);
    sub.cycleStart=iso(Date.parse(sub.cycleStart)+steps*CYCLE);sub.cycleEnd=iso(Date.parse(sub.cycleStart)+CYCLE);
  }
  if(JSON.stringify(sub)!==before) await saveSubscription(tenantId,sub);
  return sub;
 });
}
export async function subscriptionUsage(tenantId:string,sub:TenantSubscription) {
 const [staff,orders]=await Promise.all([db().getSlice<any>(tenantId,'staff'),db().getSlice<any>(tenantId,'orders')]);
 return {staffCount:(staff || []).filter(s=>s.role!=='Owner' && isActiveStaff(s)).length,ownerCount:(staff || []).filter(s=>s.role==='Owner' && isActiveStaff(s)).length,
 monthlyOrders:(orders || []).filter(o=>{const t=Date.parse(o.created_at || o.createdAt || o.date);return t>=Date.parse(sub.cycleStart) && t<Date.parse(sub.cycleEnd);}).length,
 openKots:(orders || []).filter(o=>!['Completed','Cancelled'].includes(o.status) && !o.paidAt && !(sub.frozenKots?.[o.id] && Date.now()>=Date.parse(sub.frozenKots[o.id].settleUntil))).length};
}
export async function assertOrderCreation(tenantId:string,raw:any) {
 const sub=await getSubscription(tenantId),limits=getPlanLimits(sub),usage=await subscriptionUsage(tenantId,sub);
 if(sub.isReadOnly) throw entitlementError('READ_ONLY_MODE','This subscription is read-only.');
 if(limits.monthlyOrders>=0 && usage.monthlyOrders>=limits.monthlyOrders) throw entitlementError('PLAN_LIMIT_EXCEEDED','Order allowance reached for this subscription cycle.');
 const paid=raw.paymentMethod && (!raw.status || raw.status==='Completed');
 if(sub.plan==='free' && !paid && usage.openKots>=5) throw entitlementError('OPEN_KOT_LIMIT','Free Starter allows 5 open KOTs. Settle an existing bill first.');
}
export async function assertSettlement(tenantId:string,orderId:string) {
 const sub=await getSubscription(tenantId),frozen=sub.frozenKots?.[orderId];
 if(frozen && Date.now()>=Date.parse(frozen.settleUntil)) throw entitlementError('FROZEN_KOT_EXPIRED','The 12-hour settlement window has ended. Ask the restaurant Owner to resolve this bill in Billing.');
}
/** Owner recovery never changes the original frozen bill, prices or inventory. */
export async function assertOwnerFrozenKotRecovery(tenantId:string,orderId:string,ownerId:string,reason:string) {
 if(typeof reason!=='string' || reason.trim().length<10 || reason.length>1000) throw Object.assign(new Error('Enter an audit reason of 10–1000 characters.'),{status:400});
 const staff=await db().getSlice<any>(tenantId,'staff') || [];
 const owner=staff.find(s=>s.id===ownerId && s.role==='Owner' && isActiveStaff(s));
 if(!owner) throw entitlementError('OWNER_RECOVERY_REQUIRED','Only the active restaurant Owner can recover expired trial bills.');
 const sub=await getSubscription(tenantId),snapshot=sub.frozenKots?.[orderId];
 const order=(await db().getSlice<any>(tenantId,'orders') || []).find(o=>o.id===orderId);
 if(!snapshot || !order) throw Object.assign(new Error('Frozen trial bill not found.'),{status:404});
 if(Date.now()<Date.parse(snapshot.settleUntil)) throw Object.assign(new Error('This bill is still in its normal settlement window.'),{status:400});
 if(order.paidAt || ['Completed','Cancelled'].includes(order.status)) throw Object.assign(new Error('This bill has already been resolved.'),{status:409});
 if(order.total!==snapshot.total || !isDeepStrictEqual(order.items,snapshot.items)) throw Object.assign(new Error('The bill differs from its frozen snapshot. Review the original ledger before resolving it.'),{status:409,code:'FROZEN_KOT_MISMATCH'});
 return {order,snapshot,owner};
}
export async function assertKotMutable(tenantId:string,orderId:string) {
 if((await getSubscription(tenantId)).frozenKots?.[orderId]) throw entitlementError('FROZEN_KOT','Trial KOT items and totals are frozen. Only settlement is available during its 12-hour window.');
}
export async function assertInventoryWritable(tenantId:string) {
 if((await getSubscription(tenantId)).inventoryFrozen) throw entitlementError('INVENTORY_FROZEN','Inventory is read-only on Free Starter. Upgrade to enable inventory changes and automatic stock deduction.');
}
export async function activatePaidPlan(tenantId:string,plan:'pro'|'enterprise',paidAt:string,paymentId:string) {
 await db().runTransaction(tenantId,async()=>{
  if(await db().getObject(tenantId,`paid_activation:${paymentId}`)) return;
  const sub=await getSubscription(tenantId);
  if(sub.financialReview) return;
  const at=Date.parse(paidAt);if(!Number.isFinite(at)) throw new Error('Invalid provider payment time.');
  // Same-plan renewal anchors original expiry, including the 24-hour grace.
  const previous=sub.paidUntil?Date.parse(sub.paidUntil):0;
  const same=(sub.lastPaidPlan || sub.plan)===plan;
  const start=same && previous && at<=previous+DAY?previous:at;
  await saveSubscription(tenantId,{...sub,plan,status:'active',isReadOnly:false,inventoryFrozen:false,trialEndsAt:undefined,
    paidUntil:iso(start+CYCLE),lastPaidPlan:plan,cycleStart:iso(start>at?Date.parse(sub.cycleStart):start),cycleEnd:iso(start>at?Date.parse(sub.cycleEnd):start+CYCLE)});
  await db().saveObject(tenantId,`paid_activation:${paymentId}`,{plan,paidAt});
 });
}
export async function flagFinancialReview(tenantId:string,paymentId:string,reason:string) {
 await db().runTransaction(tenantId,async()=>{
  let sub=await getSubscription(tenantId);sub=await freezeToFree(tenantId,sub,Date.now());
  await saveSubscription(tenantId,{...sub,financialReview:true,financialReviewReason:reason});
  await db().saveObject(tenantId,`paid_activation:${paymentId}`,{reversed:true,reason});
 });
}
export async function selectFreeStaff(tenantId:string,ids:string[]) {
 if(!Array.isArray(ids) || ids.length>3 || new Set(ids).size!==ids.length) throw Object.assign(new Error('Select up to 3 staff.'),{status:400});
 await db().runTransaction(tenantId,async()=>{
  const sub=await getSubscription(tenantId);if(sub.plan!=='free') throw Object.assign(new Error('Staff selection is only needed on Free Starter.'),{status:400});
  const staff=await db().getSlice<any>(tenantId,'staff') || [];
  if(ids.some(id=>!staff.some(s=>s.id===id && s.role!=='Owner'))) throw Object.assign(new Error('Invalid staff selection.'),{status:400});
  await db().saveSlice(tenantId,'staff',staff.map(s=>s.role==='Owner' || ids.includes(s.id)===isActiveStaff(s)?s:{...s,status:ids.includes(s.id)?'active':'inactive',version:(s.version || 1)+1}));
  await saveSubscription(tenantId,{...sub,staffSelectionRequired:false});
 });
}
export async function startTrial(tenantId:string) {
 const initial=await getSubscription(tenantId);
 if(initial.financialReview) throw entitlementError('FINANCIAL_REVIEW','Resolve Financial Review before starting a trial.');
 if(initial.trialUsed || initial.plan!=='free') return initial;
 // Registry identity is server-controlled registration data, never browser identifiers.
 const registry=await db().getObject<any[]>('veg-main-001','global_tenants_list') || [],tenant=registry.find(t=>t.tenantId===tenantId);
 if(!tenant?.ownerPhone) throw entitlementError('TRIAL_IDENTITY_REQUIRED','A registered restaurant mobile is required for a trial.');
 const settings=await db().getObject<any>(tenantId,'settings') || {};
 Object.assign(tenant,{gstin:tenant.gstin || settings.gstin,fssai:tenant.fssai || settings.fssaiNumber,vpa:tenant.vpa || settings.upiVpa});
 const normalized=(v:any)=>String(v || '').replace(/\s/g,'').toLowerCase();
 const hash=(v:string)=>crypto.createHash('sha256').update(v).digest('hex');
 const phone=String(tenant.ownerPhone).replace(/\D/g,'').slice(-10);
 if(!/^[6-9]\d{9}$/.test(phone)) throw entitlementError('TRIAL_IDENTITY_REQUIRED','A valid registered Indian mobile is required for a trial.');
 const decision=await db().runTransaction('saas-admin',async()=>{
  const claims=await db().getObject<Record<string,string>>('saas-admin','trial_identity_claims') || {};
  const mobile=`mobile:${hash(phone)}`;if(claims[mobile] && claims[mobile]!==tenantId) return 'blocked';
  const keys=['gstin','fssai','vpa'].filter(k=>normalized(tenant[k])).map(k=>`${k}:${hash(normalized(tenant[k]))}`);
  if(keys.some(k=>claims[k] && claims[k]!==tenantId)) return 'review';
  claims[mobile]=tenantId;for(const key of keys) claims[key]=tenantId;
  await db().saveObject('saas-admin','trial_identity_claims',claims);return 'eligible';
 });
 return db().runTransaction(tenantId,async()=>{
  const sub=await getSubscription(tenantId);
  if(sub.financialReview) throw entitlementError('FINANCIAL_REVIEW','Resolve Financial Review before starting a trial.');
  if(sub.trialUsed || sub.plan!=='free') return sub;
  if(decision!=='eligible') {const next={...sub,trialUsed:true,reviewRequired:decision==='review'};await saveSubscription(tenantId,next);return next;}
  const now=Date.now(),next={...sub,plan:'pro' as const,trialUsed:true,trialEndsAt:iso(now+14*DAY),cycleStart:iso(now),cycleEnd:iso(now+14*DAY),inventoryFrozen:false};
  await saveSubscription(tenantId,next);return next;
 });
}
export async function runAiReport<T extends {isSimulated?:boolean}>(tenantId:string,generate:()=>Promise<T>):Promise<T> {
 // AI generation is outside retrying transactions. A durable reservation caps concurrent requests;
 // successful reports consume allowance; provider failure/simulated help releases it.
 const id=crypto.randomUUID(), day=new Date(Date.now()+19800000).toISOString().slice(0,10);
 await db().runTransaction(tenantId,async()=>{
  const sub=await getSubscription(tenantId),cap=getPlanLimits(sub).aiReportsPerDay;
  if(!cap) throw entitlementError('AI_PLAN_REQUIRED','Upgrade or start an eligible trial to generate AI reports.');
  const previous=await db().getObject<any>(tenantId,'ai_report_usage');
  const usage=previous?.day===day?previous:{day,count:0,pending:{}};
  usage.pending ||= {}; for(const key of Object.keys(usage.pending)) if(Date.now()-usage.pending[key]>120000) delete usage.pending[key];
  if(usage.count+Object.keys(usage.pending).length>=cap) throw entitlementError('AI_DAILY_LIMIT','5 AI reports per day are available. Allowance resets at midnight IST.');
  usage.pending[id]=Date.now();await db().saveObject(tenantId,'ai_report_usage',usage);
 });
 let result:T;
 try {result=await generate();return result;}
 finally {await db().runTransaction(tenantId,async()=>{const usage=await db().getObject<any>(tenantId,'ai_report_usage');if(usage?.day===day && usage.pending?.[id]!==undefined){delete usage.pending[id];if(result && !result.isSimulated) usage.count++;await db().saveObject(tenantId,'ai_report_usage',usage);}});}
}
/** Only called after the MFA super-admin route guard; never grants paid access. */
export async function resolveSubscriptionReview(tenantId:string,kind:'trial'|'financial',reason:string,actor:string) {
 if(typeof reason!=='string' || reason.trim().length<10 || reason.length>1000) throw Object.assign(new Error('Enter a review reason of 10–1000 characters.'),{status:400});
 await db().runTransaction(tenantId,async()=>{
  const sub=await getSubscription(tenantId);
  if(kind==='financial') {
   if(!sub.financialReview) throw Object.assign(new Error('No financial review is pending.'),{status:409});
   await saveSubscription(tenantId,{...sub,financialReview:false,financialReviewReason:undefined});
  } else if(kind==='trial') {
   if(sub.financialReview) throw entitlementError('FINANCIAL_REVIEW','Resolve Financial Review before approving a trial.');
   if(!sub.reviewRequired || sub.plan!=='free' || sub.trialEndsAt) throw Object.assign(new Error('No trial review is pending.'),{status:409});
   const now=Date.now();await saveSubscription(tenantId,{...sub,reviewRequired:false,trialUsed:true,plan:'pro',inventoryFrozen:false,trialEndsAt:iso(now+14*DAY),cycleStart:iso(now),cycleEnd:iso(now+14*DAY)});
  } else throw Object.assign(new Error('Invalid review type.'),{status:400});
  const log=await db().getObject<any[]>(tenantId,'subscription_review_audit') || [];
  await db().saveObject(tenantId,'subscription_review_audit',[...log,{kind,reason:reason.trim(),actor,at:new Date().toISOString()}]);
 });
}
