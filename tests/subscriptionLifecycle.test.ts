import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {Database} from '../server/features/shared/database';
import {getSubscription,saveSubscription} from '../server/features/shared/subscription';
import * as lifecycle from '../server/features/billing/SubscriptionLifecycle';
import {IngredientRepository} from '../server/features/inventory/IngredientRepository';
import {PLAN_LIMITS} from '../shared/planCatalog';
const tenant='test-lifecycle'; const db=Database.getInstance();
beforeEach(()=>{(db as any).tablesByTenant[tenant]={};(db as any).objectsByTenant[tenant]={};vi.useFakeTimers();vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));});
afterEach(()=>vi.useRealTimers());
describe('subscription lifecycle',()=>{
 it('keeps Owner separate from 3/10/25 staff slots',()=>{expect(PLAN_LIMITS.free.staffCount).toBe(3);expect(PLAN_LIMITS.pro.staffCount).toBe(10);expect(PLAN_LIMITS.enterprise.staffCount).toBe(25);});
 it('enforces frozen inventory at repository writes, not only HTTP middleware',async()=>{
  const repo=new IngredientRepository();await expect(repo.add(tenant,{id:'frozen',name:'Rice'} as any)).rejects.toMatchObject({code:'INVENTORY_FROZEN'});
 });
 it('uses an anchored 30-day cycle across calendar month boundaries',async()=>{
  const first=await getSubscription(tenant);vi.setSystemTime(new Date('2026-02-01T10:00:00Z'));
  expect((await getSubscription(tenant)).cycleStart).toBe(first.cycleStart);
  vi.setSystemTime(new Date('2026-02-19T10:00:00Z'));expect((await getSubscription(tenant)).cycleStart).toBe('2026-02-19T10:00:00.000Z');
 });
 it('counts server accepted orders even if client backdates them and blocks at 30',async()=>{
  await getSubscription(tenant);await db.saveSlice(tenant,'orders',Array.from({length:30},(_,i)=>({id:String(i),date:'1999-01-01',created_at:'2026-01-21T10:00:00Z',status:'Completed'})));
  vi.setSystemTime(new Date('2026-01-22T10:00:00Z'));
  await expect(lifecycle.assertOrderCreation(tenant,{})).rejects.toMatchObject({code:'PLAN_LIMIT_EXCEEDED'});
 });
 it('limits Free to five open KOTs',async()=>{
  await getSubscription(tenant);await db.saveSlice(tenant,'orders',Array.from({length:5},(_,i)=>({id:String(i),date:new Date().toISOString(),status:'Pending'})));
  await expect(lifecycle.assertOrderCreation(tenant,{})).rejects.toMatchObject({code:'OPEN_KOT_LIMIT'});
 });
 it('freezes trial KOTs and inventory, deactivates excess nonowners, allows only 12-hour settlement',async()=>{
  await saveSubscription(tenant,{plan:'pro',status:'active',isReadOnly:false,trialEndsAt:'2026-01-20T09:00:00Z',trialUsed:true,cycleStart:'2026-01-06T09:00:00Z',cycleEnd:'2026-02-05T09:00:00Z'});
  await db.saveSlice(tenant,'orders',[{id:'open',date:'2026-01-19',status:'Pending',items:[{quantity:1}],total:99}]);
  await db.saveSlice(tenant,'staff',Array.from({length:6},(_,i)=>({id:String(i),role:i===0?'Owner':'Cashier',status:'active',pin:'keep-hash'})));
  const sub=await getSubscription(tenant);expect(sub.plan).toBe('free');expect(sub.inventoryFrozen).toBe(true);expect(sub.frozenKots.open.total).toBe(99);
  const staff=await db.getSlice<any>(tenant,'staff');expect(staff.find(s=>s.role==='Owner').status).toBe('active');expect(staff.filter(s=>s.role!=='Owner' && s.status==='active')).toHaveLength(3);expect(staff.every(s=>s.pin==='keep-hash')).toBe(true);
  await expect(lifecycle.assertSettlement(tenant,'open')).resolves.toBeUndefined();vi.setSystemTime(new Date('2026-01-20T22:00:00Z'));
  await expect(lifecycle.assertSettlement(tenant,'open')).rejects.toMatchObject({code:'FROZEN_KOT_EXPIRED'});
 });
 it('counts only successful AI reports and resets at IST midnight',async()=>{
  await saveSubscription(tenant,{plan:'pro',status:'active',isReadOnly:false});
  let calls=0; for(let i=0;i<5;i++) await lifecycle.runAiReport(tenant,async()=>{calls++;return {isSimulated:false,reply:'report'};});
  await expect(lifecycle.runAiReport(tenant,async()=>{calls++;return {isSimulated:false};})).rejects.toMatchObject({code:'AI_DAILY_LIMIT'});expect(calls).toBe(5);
  vi.setSystemTime(new Date('2026-01-20T18:30:00Z'));await expect(lifecycle.runAiReport(tenant,async()=>({isSimulated:true}))).resolves.toMatchObject({isSimulated:true});
  expect((await db.getObject<any>(tenant,'ai_report_usage')).count).toBe(0);
 });
 it('renews inside grace at original expiry; a mid-cycle Elite payment starts fresh',async()=>{
  await saveSubscription(tenant,{plan:'pro',status:'active',isReadOnly:false,paidUntil:'2026-01-20T09:00:00Z',cycleStart:'2025-12-21T09:00:00Z',cycleEnd:'2026-01-20T09:00:00Z'});
  await lifecycle.activatePaidPlan(tenant,'pro','2026-01-20T10:00:00Z','payment-1');expect((await getSubscription(tenant)).paidUntil).toBe('2026-02-19T09:00:00.000Z');
  await lifecycle.activatePaidPlan(tenant,'enterprise','2026-01-20T10:00:00Z','payment-2');expect((await getSubscription(tenant)).paidUntil).toBe('2026-02-19T10:00:00.000Z');
 });
 it('rejects replayed paid activation and never clears financial review from a payment replay',async()=>{
  await lifecycle.activatePaidPlan(tenant,'pro',new Date().toISOString(),'p1');const expiry=(await getSubscription(tenant)).paidUntil;
  await lifecycle.activatePaidPlan(tenant,'pro',new Date().toISOString(),'p1');expect((await getSubscription(tenant)).paidUntil).toBe(expiry);
  await lifecycle.flagFinancialReview(tenant,'p1','refund');await lifecycle.activatePaidPlan(tenant,'pro',new Date().toISOString(),'p1');expect((await getSubscription(tenant)).plan).toBe('free');expect((await getSubscription(tenant)).financialReview).toBe(true);
 });
});
it('expired trial snapshot bills do not permanently consume Free open-KOT slots',async()=>{
 await saveSubscription(tenant,{plan:'free',status:'active',isReadOnly:false,frozenKots:Object.fromEntries(Array.from({length:6},(_,i)=>['legacy'+i,{total:99,items:[],settleUntil:'2026-01-19T00:00:00Z'}]))});
 await db.saveSlice(tenant,'orders',Array.from({length:6},(_,i)=>({id:'legacy'+i,status:'Pending',date:'2026-01-01'})));
 await expect(lifecycle.assertOrderCreation(tenant,{})).resolves.toBeUndefined();
});
it('trial review approval cannot bypass unresolved Financial Review',async()=>{
 await saveSubscription(tenant,{plan:'free',status:'active',isReadOnly:false,reviewRequired:true,financialReview:true});
 await expect(lifecycle.resolveSubscriptionReview(tenant,'trial','Reviewed eligibility by owner','admin-id')).rejects.toMatchObject({code:'FINANCIAL_REVIEW'});
 expect((await getSubscription(tenant)).plan).toBe('free');
});
it('keeps the current cycle usage anchor when a same-plan renewal is paid early',async()=>{
 await saveSubscription(tenant,{plan:'pro',status:'active',isReadOnly:false,inventoryFrozen:false,paidUntil:'2026-01-25T10:00:00Z',cycleStart:'2025-12-26T10:00:00Z',cycleEnd:'2026-01-25T10:00:00Z'});
 await lifecycle.activatePaidPlan(tenant,'pro','2026-01-20T10:00:00Z','early-renewal');const sub=await getSubscription(tenant);
 expect(sub.cycleStart).toBe('2025-12-26T10:00:00.000Z');expect(sub.paidUntil).toBe('2026-02-24T10:00:00.000Z');
});
