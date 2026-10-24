import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import http from 'node:http';
import {app} from '../server';
import {Database} from '../server/features/shared/database';
import {staffRepo,menuRepo,sessionService,saveGlobalTenantsList} from '../server/context';
import {getSubscription,saveSubscription} from '../server/features/shared/subscription';
import {startTrial,runAiReport} from '../server/features/billing/SubscriptionLifecycle';
const tenant='test-lifecycle-api',db=Database.getInstance();let server:http.Server,base:string,token:string;
beforeAll(async()=>{server=http.createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as any).port}/api`;});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
beforeEach(async()=>{
 (db as any).tablesByTenant[tenant]={};(db as any).objectsByTenant[tenant]={};(db as any).objectsByTenant['saas-admin']={};
 await saveGlobalTenantsList([{id:tenant,tenantId:tenant,name:'Test',ownerPhone:'9876543210',status:'active'}] as any);
 await staffRepo.saveAll(tenant,[{id:'owner',name:'Owner',role:'Owner',status:'active',permissions:['billing','orders','inventory','staff','reports']} as any]);
 await menuRepo.saveAll(tenant,[{id:'meal',name:'Meal',price:100,isAvailable:true}] as any);
 token=(await sessionService.createSession(tenant,'owner','Owner','Owner','','',['billing','orders','inventory','staff','reports'])).sessionId;
});
async function request(path:string,body?:any,key?:string){return fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','x-session-id':token,...(key?{'idempotency-key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
describe('lifecycle command boundaries',()=>{
 it('serializes concurrent creation at the last cycle order slot, including offline commands',async()=>{
  await getSubscription(tenant);await db.saveSlice(tenant,'orders',Array.from({length:29},(_,i)=>({id:'old'+i,date:new Date().toISOString(),created_at:new Date().toISOString(),status:'Completed'})));
  const order=(id:string)=>({id,items:[{menuItemId:'meal',quantity:1}],status:'Completed',paymentMethod:'Cash'});
  const responses=await Promise.all([request('/orders',order('a'),'cycle-command-a'),request('/sync/outbox',{operationId:'op-b',entityType:'order',operationType:'CREATE',entityId:'b',payload:order('b')},'cycle-command-b')]);
  expect(responses.map(r=>r.status).sort()).toEqual([200,403]);expect((await db.getSlice(tenant,'orders'))!.length).toBe(30);
 });
 it('rejects Free inventory and sync writes while billing remains accessible',async()=>{
  expect((await request('/ingredients',{id:'rice',name:'Rice'})).status).toBe(403);
  const sync=await request('/sync',{ingredients:[{id:'rice',name:'Rice',currentStock:10,costPerUnit:1,minStock:1,unit:'kg'}]});expect(sync.status).toBe(403);
  expect((await request('/billing/subscription')).status).toBe(200);
 });
 it('trial cannot be restarted and the same mobile cannot earn a second trial',async()=>{
  const first=await startTrial(tenant);expect(first.trialEndsAt).toBeTruthy();expect((await startTrial(tenant)).trialEndsAt).toBe(first.trialEndsAt);
  const other='test-trial-duplicate';(db as any).tablesByTenant[other]={};(db as any).objectsByTenant[other]={};
  await saveGlobalTenantsList([{id:tenant,tenantId:tenant,ownerPhone:'9876543210'},{id:other,tenantId:other,ownerPhone:'9876543210'}] as any);
  const second=await startTrial(other);expect(second.plan).toBe('free');expect(second.trialUsed).toBe(true);expect(second.trialEndsAt).toBeUndefined();
 });
 it('stops an excess staff session after trial expiry before authorizing a mutation',async()=>{
  await saveSubscription(tenant,{plan:'pro',status:'active',isReadOnly:false,inventoryFrozen:false,trialEndsAt:new Date(Date.now()-1000).toISOString()});
  await db.saveSlice(tenant,'staff',[{id:'owner',name:'Owner',role:'Owner',status:'active',permissions:[]},...Array.from({length:4},(_,i)=>({id:'s'+i,name:'Staff',role:'Cashier',status:'active',permissions:['billing']}))]);
  // Minting a session does not itself process expiry; validation must process it first.
  token=(await sessionService.createSession(tenant,'s3','Staff','Cashier','','',['billing'])).sessionId;
  const r=await request('/orders',{id:'late',items:[{menuItemId:'meal',quantity:1}]},'expired-trial-order');expect([401,403]).toContain(r.status);expect(await db.getSlice(tenant,'orders')).toEqual([]);
 });
 it('caps concurrent AI generations without charging failed or simulated reports',async()=>{
  await saveSubscription(tenant,{plan:'pro',status:'active',isReadOnly:false,inventoryFrozen:false});
  const release:Function[]=[];const started=Array.from({length:5},()=>runAiReport(tenant,()=>new Promise<any>(r=>release.push(r))));
  while(release.length<5) await new Promise(r=>setTimeout(r,1));
  await expect(runAiReport(tenant,async()=>({isSimulated:false}))).rejects.toMatchObject({code:'AI_DAILY_LIMIT'});
  release.forEach(r=>r({isSimulated:false}));await Promise.all(started);
  expect((await db.getObject<any>(tenant,'ai_report_usage')).count).toBe(5);
 });
 it('rejects unsigned Cashfree webhook before accessing payment state and retires mock billing',async()=>{
  vi.stubEnv('CASHFREE_SECRET_KEY','test-key');try{expect((await request('/webhooks/cashfree',{type:'PAYMENT_LINK_EVENT'})).status).toBe(400);}finally{vi.unstubAllEnvs();}
  expect((await request('/billing/mock-payment-success',{plan:'enterprise'})).status).toBe(404);
 });
});
it('does not let extra Owner accounts bypass the active staff cap',async()=>{
 const response=await request('/staff',{id:'extra-owner',name:'Extra',role:'Owner',status:'active',permissions:['billing'],pin:'53186'});expect(response.status).toBe(403);
});
it('continues Free billing with frozen zero-stock recipes after downgrade without changing inventory',async()=>{
 await db.saveObject(tenant,'settings',{autoDeductStock:true,blockOrdersIfInsufficient:true});
 await db.saveSlice(tenant,'ingredients',[{id:'rice',name:'Rice',currentStock:0,minStock:1,costPerUnit:20,unit:'kg'}]);
 await db.saveSlice(tenant,'recipes',[{menuItemId:'meal',ingredients:[{ingredientId:'rice',quantity:1,unit:'kg'}]}]);
 const response=await request('/orders',{id:'free-after-downgrade',items:[{menuItemId:'meal',quantity:1}],status:'Completed',paymentMethod:'Cash'},'frozen-stock-sale');
 expect(response.status).toBe(200);expect((await db.getSlice<any>(tenant,'ingredients'))[0].currentStock).toBe(0);expect(await db.getSlice(tenant,'inventoryMovements')).toEqual([]);
});
it('does not grant trial features during unresolved Financial Review',async()=>{
 await saveSubscription(tenant,{plan:'free',status:'active',isReadOnly:false,financialReview:true,trialUsed:false});
 const response=await request('/billing/start-trial',{});expect(response.status).toBe(403);expect((await getSubscription(tenant)).plan).toBe('free');
});
