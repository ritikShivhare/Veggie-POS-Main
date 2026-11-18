import {beforeAll,afterAll,it,expect} from 'vitest';
import http from 'node:http';
import {app} from '../server';
import {Database} from '../server/features/shared/database';
import {staffRepo,sessionService,getGlobalTenantsList,saveGlobalTenantsList,realtimeService} from '../server/context';
let server:http.Server,base:string,token:string;
const tenant='guest-history-a',other='guest-history-b';
beforeAll(async()=>{
 server=http.createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;
 await saveGlobalTenantsList([...(await getGlobalTenantsList()),...[tenant,other].map(id=>({id,tenantId:id,name:id,status:'active'}))] as any);
 await staffRepo.saveAll(tenant,[{id:'cashier',name:'Cashier',role:'Cashier',status:'active',permissions:['billing']} as any]);
 token=(await sessionService.createSession(tenant,'cashier','Cashier','Cashier','127.0.0.1','test',['billing'])).sessionId;
 const db=Database.getInstance();
 await db.saveSlice(tenant,'customers',[{id:'guest-a'}]);await db.saveSlice(other,'customers',[{id:'guest-b'}]);
 const paid={id:'paid',customerId:'guest-a',date:'2026-11-14',paidAt:'2026-11-14T10:00:00Z',status:'Completed',total:100,earnedPoints:1,redeemedPoints:5,items:[]};
 await db.saveSlice(tenant,'orders',[paid,{...paid,id:'legacy-paid',date:'2026-11-13',paidAt:undefined,paymentMethod:'Cash'},{...paid,id:'unpaid',status:'Pending',paidAt:undefined},{...paid,id:'cancelled',status:'Cancelled'},{...paid,id:'someone-else',customerId:'different'}]);
 await db.saveSlice(other,'orders',[{...paid,id:'foreign'}]);
});
afterAll(async()=>{realtimeService.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
it('returns only this guest’s confirmed paid bills and recorded points',async()=>{
 const response=await fetch(base+'/api/customers/guest-a/history',{headers:{'x-session-id':token}});
 expect(response.status).toBe(200);const data=await response.json();expect(data.data.map((order:any)=>order.id)).toEqual(['paid','legacy-paid']);expect(data.data[0].earnedPoints).toBe(1);
});
it('rejects a foreign guest and a forged tenant header',async()=>{
 expect((await fetch(base+'/api/customers/guest-b/history',{headers:{'x-session-id':token}})).status).toBe(404);
 expect((await fetch(base+'/api/customers/guest-a/history',{headers:{'x-session-id':token,'x-tenant-id':other}})).status).toBe(403);
});
it('requires authentication',async()=>{
 expect((await fetch(base+'/api/customers/guest-a/history')).status).toBe(401);
});
