import {beforeAll,afterAll,expect,it} from 'vitest';
import http from 'node:http';
import {app} from '../server';
import {Database} from '../server/features/shared/database';
import {staffRepo,sessionService,getGlobalTenantsList,saveGlobalTenantsList,realtimeService} from '../server/context';
let server:http.Server,base:string,waiter:string,cashier:string,foreign:string,bill:any;
const tenant='running-routes-'+crypto.randomUUID();
const api=async(path:string,token:string,method='GET',body?:any,key?:string)=>{
 const response=await fetch(base+'/api'+path,{method,headers:{'x-session-id':token,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};
};
beforeAll(async()=>{
 server=http.createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as any).port}`;
 await saveGlobalTenantsList([...(await getGlobalTenantsList()),...[tenant,tenant+'-other'].map(id=>({id,tenantId:id,name:id,status:'active'}))] as any);
 const db=Database.getInstance();await db.saveObject(tenant,'subscription_v1',{plan:'pro',status:'active',isReadOnly:false,inventoryFrozen:false});
 await db.saveObject(tenant,'settings',{gstPercentage:5,autoDeductStock:false});
 await db.saveSlice(tenant,'customers',[{id:'guest',name:'Guest',phone:'9000000000',loyaltyPoints:99,totalSpend:5000,totalVisits:20}]);
 await db.saveSlice(tenant,'menuItems',[{id:'meal',name:'Meal',price:100,isAvailable:true}]);
 for(const tid of [tenant,tenant+'-other'])await staffRepo.saveAll(tid,[{id:'waiter',name:'Waiter',role:'Waiter',permissions:['orders'],status:'active'},{id:'cashier',name:'Cashier',role:'Cashier',permissions:['billing'],status:'active'}] as any);
 waiter=(await sessionService.createSession(tenant,'waiter','Waiter','Waiter','127.0.0.1','test',['orders'])).sessionId;
 cashier=(await sessionService.createSession(tenant,'cashier','Cashier','Cashier','127.0.0.1','test',['billing'])).sessionId;
 foreign=(await sessionService.createSession(tenant+'-other','cashier','Cashier','Cashier','127.0.0.1','test',['billing'])).sessionId;
 const first=await api('/orders',waiter,'POST',{id:crypto.randomUUID(),runningOrderFlow:true,status:'Pending',items:[{menuItemId:'meal',quantity:1}]},'create-running');expect(first.status).toBe(200);bill=first.data.order;
});
afterAll(async()=>{realtimeService.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
it('lets a waiter append and returns the canonical combined bill once on replay',async()=>{
 const body={operationId:'route-addon-1',expectedVersion:bill.running?.billVersion ?? bill.version,items:[{menuItemId:'meal',quantity:1,note:'no salt'}]};
 const first=await api(`/orders/${bill.id}/add-items`,waiter,'POST',body,'add-1');expect(first.status).toBe(200);expect(first.data.data.total).toBe(210);bill=first.data.data;
 expect((await api(`/orders/${bill.id}/add-items`,waiter,'POST',body,'add-1')).data.data.total).toBe(210);
});
it('prevents waiter settlement, foreign bill access, forged tenant and generic batch bypass',async()=>{
 expect((await api(`/orders/${bill.id}/pay`,waiter,'POST',{amount:210,paymentMethod:'Cash'},'deny-pay')).status).toBe(403);
 expect((await api(`/orders/${bill.id}/add-items`,foreign,'POST',{operationId:'foreign-addon',expectedVersion:bill.running?.billVersion ?? bill.version,items:[{menuItemId:'meal',quantity:1}]},'foreign-add')).status).toBe(404);
 expect((await api(`/orders/${bill.id}`,waiter,'PUT',{status:'Ready',version:bill.version},'bypass')).status).toBe(400);
 const bad=await fetch(base+`/api/orders/${bill.id}/add-items`,{method:'POST',headers:{'x-session-id':waiter,'x-tenant-id':tenant+'-other','Content-Type':'application/json'},body:JSON.stringify({})});expect(bad.status).toBe(403);
});
it('shares only guest identity with order-taking staff, keeping loyalty and spend private',async()=>{
 const result=await api('/sync',waiter);expect(result.status).toBe(200);
 const state=result.data.data || result.data;expect(state.customers).toEqual([{id:'guest',name:'Guest',phone:'9000000000'}]);
});
it('updates only the chosen KOT and keeps the first KOT pending',async()=>{
 const batch=bill.running.batches[1];const response=await api(`/orders/${bill.id}/kot/${batch.id}/status`,waiter,'POST',{version:batch.version,status:'Preparing'},'kot-prepare');
 expect(response.status).toBe(200);expect(response.data.data.running.batches.map((b:any)=>b.status)).toEqual(['Pending','Preparing']);bill=response.data.data;
});
it('settles once with cashier permission and returns the confirmed combined receipt',async()=>{
 const body={expectedVersion:bill.running?.billVersion ?? bill.version,amount:210,paymentMethod:'Cash',cashReceived:300,discountPercent:0};
 const first=await api(`/orders/${bill.id}/pay`,cashier,'POST',body,'settle-once');expect(first.status).toBe(200);expect(first.data.order.paidAt).toBeTruthy();
 const replay=await api(`/orders/${bill.id}/pay`,cashier,'POST',body,'settle-once');expect(replay.status).toBe(200);expect(replay.data.payment.id).toBe(first.data.payment.id);
 expect((await Database.getInstance().getSlice(tenant,'payments'))).toHaveLength(1);
});
