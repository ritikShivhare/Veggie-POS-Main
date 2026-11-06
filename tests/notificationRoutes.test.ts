import {beforeAll,afterAll,it,expect} from 'vitest';
import http from 'node:http';
import {app} from '../server';
import {Database} from '../server/features/shared/database';
import {staffRepo,sessionService,getGlobalTenantsList,saveGlobalTenantsList,realtimeService} from '../server/context';
import {defaultNotificationRules} from '../src/features/shared/notificationRules';
let server:http.Server,base:string;const tenant='notification-http-a',other='notification-http-b',tokens:Record<string,string>={};
beforeAll(async()=>{
 server=http.createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;
 await saveGlobalTenantsList([...(await getGlobalTenantsList()),...[tenant,other].map(id=>({id,tenantId:id,name:id,status:'active'}))] as any);
 for(const tid of [tenant,other]){
  await staffRepo.saveAll(tid,[{id:'owner',name:'Owner',role:'Owner',status:'active',permissions:['billing','settings']},{id:'cook',name:'Cook',role:'Chef',status:'active',permissions:['billing']} as any]);
  for(const [id,role] of [['owner','Owner'],['cook','Chef']])tokens[tid+id]=(await sessionService.createSession(tid,id,id,role,'127.0.0.1','test',['billing','settings'])).sessionId;
 }
});
afterAll(async()=>{realtimeService.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
async function call(path:string,id='owner',body?:any,method?:string,tenantHeader?:string){const res=await fetch(base+'/api'+path,{method:method || (body?'POST':'GET'),headers:{'content-type':'application/json','x-session-id':tokens[tenant+id],...(tenantHeader?{'x-tenant-id':tenantHeader}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};}
it('permits Owner explicit settings save but rejects kitchen access, stale edits and forged tenants',async()=>{
 expect((await call('/notification-settings','cook')).status).toBe(403);
 expect((await call('/notification-settings','cook',defaultNotificationRules,'PUT')).status).toBe(403);
 expect((await call('/notification-settings','owner',defaultNotificationRules,'PUT',other)).status).toBe(403);
 const saved=await call('/notification-settings','owner',defaultNotificationRules,'PUT');expect(saved.status).toBe(200);expect(saved.data.data.version).toBe(2);
 expect((await call('/notification-settings','owner',defaultNotificationRules,'PUT')).status).toBe(409);
});
it('filters the inbox and hides dispatch logs from Cook; guessed reads cannot touch another recipient',async()=>{
 const db=Database.getInstance();await db.saveObject(tenant,'system_notifications',[{id:'mine',recipientIds:['cook'],title:'Kitchen',read:false},{id:'private',recipientIds:['owner'],title:'Owner only',read:false}]);await db.saveObject(tenant,'notification_dispatch_logs',[{recipient:'private@example.test'}]);
 const result=await call('/notifications','cook');expect(result.status).toBe(200);expect(result.data.notifications.map((n:any)=>n.id)).toEqual(['mine']);expect(result.data.dispatchLogs).toEqual([]);
 expect((await call('/notifications/read','cook',{id:'private'})).data.success).toBe(false);
 expect((await call('/notifications/clear-logs','cook',{})).status).toBe(403);
 expect((await call('/notifications','cook',undefined,'GET',other)).status).toBe(403);
});
it('requires the session header on protected notification requests',async()=>{const res=await fetch(base+'/api/notifications');expect(res.status).toBe(401);});
it('persists explicit served confirmation and preserves financial fields; foreign order stays inaccessible',async()=>{
 const db=Database.getInstance(),order={id:'served-test',date:new Date().toISOString(),status:'Ready',version:1,total:100,tax:5,items:[],orderNumber:'#service-test'};
 await db.saveSlice(tenant,'orders',[order]);await db.saveSlice(other,'orders',[{...order,id:'foreign-order'}]);
 expect((await call('/orders/foreign-order/serve','cook',{version:1})).status).toBe(404);
 expect((await call('/orders/served-test/serve','cook',{version:1})).status).toBe(200);
 expect((await db.getSlice(tenant,'orders'))?.[0]).toEqual(order);expect(await db.getSlice(tenant,'payments')).toEqual([]);
 const sync=await call('/sync','cook');expect(sync.data.data.orders[0].servedAt).toBeTruthy();
});
