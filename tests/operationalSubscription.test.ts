import {beforeAll,afterAll,beforeEach,afterEach,it,expect,vi} from 'vitest';
import http from 'node:http';
import {app} from '../server';
import {Database} from '../server/features/shared/database';
import {staffRepo,sessionService,auditLogService,saveGlobalTenantsList} from '../server/context';
import {getSubscription,saveSubscription} from '../server/features/shared/subscription';
const tenant='test-operational-subscription',db=Database.getInstance();let server:http.Server,base:string,token:string;
beforeAll(async()=>{server=http.createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as any).port}/api`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
afterEach(()=>vi.restoreAllMocks());
beforeEach(async()=>{
 (db as any).tablesByTenant[tenant]={};(db as any).objectsByTenant[tenant]={};
 await saveGlobalTenantsList([{id:tenant,tenantId:tenant,status:'active'}] as any);
 await staffRepo.saveAll(tenant,[{id:'owner',name:'Owner',role:'Owner',status:'active',permissions:['billing','orders','staff']} as any,{id:'cashier',name:'Cashier',role:'Cashier',status:'active',permissions:['billing']} as any,{id:'manager',name:'Manager',role:'Manager',status:'active',permissions:['billing']} as any]);
 token=(await sessionService.createSession(tenant,'owner','Owner','Owner','','',['billing','orders','staff'])).sessionId;
 const items:any[]=[{menuItemId:'meal',quantity:1}];
 await db.saveSlice(tenant,'orders',[{id:'old-kot',orderNumber:'#OLD',date:'2026-01-01',status:'Ready',items,subtotal:125,total:125,tax:0,version:1}]);
 await saveSubscription(tenant,{plan:'free',status:'active',isReadOnly:false,inventoryFrozen:true,frozenKots:{'old-kot':{items,total:125,settleUntil:new Date(Date.now()-3600000).toISOString()}}});
});
const request=(path:string,body?:any,key?:string)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','x-session-id':token,...(key?{'idempotency-key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
const recovery=(action='settle',reason='Owner verified old unpaid bill',key='recover-old-kot')=>request('/billing/frozen-kots/old-kot/recover',{action,reason,paymentMethod:'Cash'},key);
it('lets Owner settle an expired snapshot on Free at its original amount with audit and one payment',async()=>{
 const r=await recovery();expect(r.status).toBe(200);expect((await db.getSlice<any>(tenant,'payments'))[0].amount).toBe(125);
 expect((await db.getSlice<any>(tenant,'orders'))[0]).toMatchObject({total:125,status:'Completed'});
 expect((await auditLogService.getLogs(tenant)).find(l=>l.eventType==='FROZEN_KOT_RECOVERED')?.details).toMatchObject({action:'settle',reason:'Owner verified old unpaid bill',orderId:'old-kot'});
 expect((await recovery()).status).toBe(200);expect(await db.getSlice(tenant,'payments')).toHaveLength(1);
});
it('allows Owner recovery after a later paid upgrade without changing the snapshot',async()=>{
 const sub=await getSubscription(tenant);await saveSubscription(tenant,{...sub,plan:'pro',inventoryFrozen:false,paidUntil:new Date(Date.now()+86400000).toISOString()});
 expect((await recovery()).status).toBe(200);expect((await getSubscription(tenant)).frozenKots['old-kot'].total).toBe(125);
});
it('closes unpaid snapshots without inventing a payment, revenue, refund or stock movement',async()=>{
 const r=await recovery('close');expect(r.status).toBe(200);expect((await db.getSlice<any>(tenant,'orders'))[0]).toMatchObject({status:'Cancelled',total:125});
 expect(await db.getSlice(tenant,'payments')).toEqual([]);expect(await db.getSlice(tenant,'inventoryMovements')).toEqual([]);
 expect((await auditLogService.getLogs(tenant)).some(l=>l.eventType==='FROZEN_KOT_RECOVERED' && l.details.action==='close')).toBe(true);
});
it.each(['Cashier','Manager'])('does not allow %s to use Owner recovery, including forged role fields',async role=>{
 token=(await sessionService.createSession(tenant,role.toLowerCase(),role,role,'','',['billing'])).sessionId;
 expect((await recovery()).status).toBe(403);
 const r=await request('/orders/old-kot/pay',{amount:125,paymentMethod:'Cash',frozenRecovery:{ownerId:'owner',reason:'Forged owner permission'}});expect(r.status).toBe(403);
 expect(await db.getSlice(tenant,'payments')).toEqual([]);
});
it('requires an audit reason and only recovers an actually expired snapshot',async()=>{
 expect((await recovery('close','short')).status).toBe(400);
 const sub=await getSubscription(tenant);sub.frozenKots['old-kot'].settleUntil=new Date(Date.now()+3600000).toISOString();await saveSubscription(tenant,sub);
 expect((await recovery()).status).toBe(400);expect(await db.getSlice(tenant,'payments')).toEqual([]);
});
it('rejects an altered frozen total and another tenant order',async()=>{
 const rows=await db.getSlice<any>(tenant,'orders');rows[0].total=1;await db.saveSlice(tenant,'orders',rows);
 expect((await recovery()).status).toBe(409);
 const r=await request('/billing/frozen-kots/foreign-order/recover',{action:'close',reason:'Owner reviewed stale order'});expect(r.status).toBe(404);
});
it('rolls settlement back if the recovery audit cannot persist',async()=>{
 const original=auditLogService.log.bind(auditLogService);vi.spyOn(auditLogService,'log').mockImplementation(async(...args)=>{if(args[1]==='FROZEN_KOT_RECOVERED')throw new Error('Audit write failed');return original(...args);});
 expect((await recovery()).status).toBe(500);expect(await db.getSlice(tenant,'payments')).toEqual([]);expect((await db.getSlice<any>(tenant,'orders'))[0].status).toBe('Ready');
});
it('retains the first three active staff with Cashier/Manager priority and never revives inactive records',async()=>{
 const list=[['owner','Owner','active'],['waiter1','Waiter','active'],['waiter2','Waiter','active'],['cashier1','Cashier','active'],['manager1','Manager','active'],['cashier2','Cashier','active'],['disabled','Cashier','inactive']].map(([id,role,status])=>({id,role,status,name:id,pin:'unchanged-hash',version:1}));
 await db.saveSlice(tenant,'staff',list);await saveSubscription(tenant,{plan:'pro',status:'active',isReadOnly:false,inventoryFrozen:false,paidUntil:new Date(Date.now()-1000).toISOString()});
 const keepSession=await sessionService.createSession(tenant,'cashier1','Cashier','Cashier','','',['billing']);
 const sub=await getSubscription(tenant),staff=await db.getSlice<any>(tenant,'staff');
 expect(staff.filter(s=>s.role!=='Owner' && s.status==='active').map(s=>s.id)).toEqual(['cashier1','manager1','cashier2']);
 expect(staff.find(s=>s.id==='owner').status).toBe('active');expect(staff.find(s=>s.id==='disabled').status).toBe('inactive');expect(staff.every(s=>s.pin==='unchanged-hash')).toBe(true);expect(sub.staffSelectionRequired).toBe(true);
 expect(await sessionService.validateAndTouchSession(tenant,keepSession.sessionId)).not.toBeNull();
});
it('lets Owner change Free staff selection repeatedly after the initial downgrade',async()=>{
 const first=await request('/billing/select-staff',{staffIds:['cashier']});expect(first.status).toBe(200);
 const billing=await (await request('/billing/subscription')).json();expect(billing.staffOptions.map((s:any)=>s.id)).toContain('manager');
 expect((await request('/billing/select-staff',{staffIds:['manager']})).status).toBe(200);
 expect((await db.getSlice<any>(tenant,'staff')).filter(s=>s.role!=='Owner' && s.status==='active').map(s=>s.id)).toEqual(['manager']);
});
it('does not revoke retained counter staff when Owner saves the same Free selection',async()=>{
 const cashierSession=await sessionService.createSession(tenant,'cashier','Cashier','Cashier','','',['billing']);
 expect((await request('/billing/select-staff',{staffIds:['cashier','manager']})).status).toBe(200);
 expect(await sessionService.validateAndTouchSession(tenant,cashierSession.sessionId)).not.toBeNull();
});
