import {beforeAll,afterAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import http from 'node:http';
import {app} from '../server';
import {Database} from '../server/features/shared/database';
import {staffRepo,sessionService,realtimeService,getGlobalTenantsList,saveGlobalTenantsList,syncService} from '../server/context';
import {toDatabaseRow,fromDatabaseRow} from '../server/features/shared/schema';
import {countActiveStaff} from '../src/features/shared/staffStatus';
const tenant='test-active-capacity',other='test-active-capacity-other';
let server:http.Server,base:string,token:string;
const member=(id:string,status:any='active')=>({id,name:id,role:id==='owner'?'Owner':'Cashier',pin:'48261',permissions:['billing'],status}) as any;
async function req(path:string,body?:any,method?:string,tenantHeader?:string){
 const response=await fetch(base+'/api'+path,{method:method || (body===undefined?'GET':'POST'),headers:{'Content-Type':'application/json','x-session-id':token,...(tenantHeader?{'x-tenant-id':tenantHeader}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
beforeAll(async()=>{
 server=http.createServer(app);realtimeService.attach(server);
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as any).port}`;
 const tenants=await getGlobalTenantsList();await saveGlobalTenantsList([...tenants,...[tenant,other].map(id=>({id,tenantId:id,name:id,status:'active'}))] as any);
});
afterAll(async()=>{realtimeService.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
beforeEach(async()=>{
 const db:any=Database.getInstance();for(const id of [tenant,other]){db.tablesByTenant[id]={};db.objectsByTenant[id]={};}
 await staffRepo.saveAll(tenant,[member('owner'),member('old-1','inactive'),member('old-2','inactive')]);
 token=(await sessionService.createSession(tenant,'owner','owner','Owner','127.0.0.1','Test',['staff','billing','settings'])).sessionId;
});
afterEach(()=>vi.restoreAllMocks());
describe('Active staff capacity and lifecycle',()=>{
 it('counts active/legacy active status, not inactive, suspended or unknown status',()=>{
  expect(countActiveStaff([{status:'active'},{status:'inactive'},{status:'suspended'},{},{status:null},{status:'Active'},{status:'unknown'}] as any)).toBe(4);
 });
 it('maps the real SQL status field without inventing isActive',()=>{
  const sql=toDatabaseRow('staff',tenant,member('old','inactive'));
  expect(sql.status).toBe('inactive');expect(sql).not.toHaveProperty('isActive');
  expect(fromDatabaseRow('staff',sql).status).toBe('inactive');
 });
 it('shows one active staff in usage and permits two replacements while retaining deleted rows',async()=>{
  expect((await req('/billing/subscription')).data.usage.staffCount).toBe(1);
  expect((await req('/staff',member('new-1'))).status).toBe(200);
  expect((await req('/staff',member('new-2'))).status).toBe(200);
  const blocked=await req('/staff',member('new-3'));expect(blocked.status).toBe(403);expect(blocked.data.error).toBe('PLAN_LIMIT_EXCEEDED');
  expect((await staffRepo.getAll(tenant))!.length).toBe(5);
  expect((await req('/staff')).data.data).toHaveLength(3);
 });
 it('serializes concurrent creates so only the available active slot is used',async()=>{
  await staffRepo.add(tenant,member('second'));
  const results=await Promise.all([req('/staff',member('parallel-a')),req('/staff',member('parallel-b'))]);
  expect(results.map(r=>r.status).sort()).toEqual([200,403]);
  expect(countActiveStaff((await staffRepo.getAll(tenant))!)).toBe(3);
 });
 it('enforces capacity on reactivation and the versioned sync path too',async()=>{
  await staffRepo.add(tenant,member('second'));await staffRepo.add(tenant,member('third'));
  const old=(await staffRepo.getById(tenant,'old-1'))!;
  expect((await req('/staff/old-1',{status:'active',version:old.version},'PUT')).status).toBe(403);
  await expect(syncService.saveFullState(tenant,{staffList:[member('sync-bypass')]})).rejects.toMatchObject({code:'PLAN_LIMIT_EXCEEDED'});
 });
 it('soft-deletes without rehashing credentials, retains rows and protects Owner/cross-tenant boundaries',async()=>{
  await staffRepo.add(tenant,member('remove-me'));const previous=(await staffRepo.getById(tenant,'remove-me'))!;
  expect((await req('/staff/remove-me',undefined,'DELETE')).status).toBe(200);
  const next=(await staffRepo.getById(tenant,'remove-me'))!;expect(next.status).toBe('inactive');expect(next.pin).toBe(previous.pin);
  expect((await req('/staff/owner',undefined,'DELETE')).status).toBe(400);
  await staffRepo.saveAll(other,[member('foreign')]);expect((await req('/staff/foreign',undefined,'DELETE')).status).toBe(404);
  expect((await req('/staff',member('foreign-write'),'POST',other)).status).toBe(403);
  expect((await staffRepo.getById(other,'foreign'))!.status).toBe('active');
 });
 it('rejects inactive PIN authentication and invalidates existing inactive staff sessions',async()=>{
  await staffRepo.add(tenant,{...member('disabled'),'pin':'92716'});
  const session=await sessionService.createSession(tenant,'disabled','disabled','Cashier','127.0.0.1','Test',['billing']);
  await staffRepo.update(tenant,{id:'disabled',status:'inactive'} as any);
  const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantId:tenant,pin:'92716'})});
  expect(response.status).toBe(401);expect(await sessionService.validateAndTouchSession(tenant,session.sessionId)).toBeNull();
 });
 it('updates three staff independently, revoking each target session while preserving Owner access',async()=>{
  await Database.getInstance().saveObject(tenant,'stripe_subscription',{plan:'pro',status:'active',isReadOnly:false});
  for(const [id,pin] of [['edit-a','32581'],['edit-b','32582'],['edit-c','32583']]) {
   await staffRepo.add(tenant,{...member(id),pin});
   const target=await sessionService.createSession(tenant,id,id,'Cashier','127.0.0.1','Test',['billing']);
   const edit=await req('/staff/'+id,{pin:'9'+pin.slice(1),permissions:['billing','inventory'],version:1},'PUT');
   expect(edit.status).toBe(200);expect(edit.data.data).not.toHaveProperty('pin');
   expect(await sessionService.validateAndTouchSession(tenant,target.sessionId)).toBeNull();
   expect(await sessionService.validateAndTouchSession(tenant,token)).not.toBeNull();
  }
 });
 it('rejects incomplete PINs, stale versions, and removing Owner permissions without changing records',async()=>{
  await staffRepo.add(tenant,{...member('editable'),pin:'64281'});
  expect((await req('/staff/editable',{pin:'12',version:1},'PUT')).status).toBe(400);
  expect((await req('/staff/editable',{permissions:['inventory'],version:1},'PUT')).status).toBe(200);
  expect((await req('/staff/editable',{permissions:['reports'],version:1},'PUT')).status).toBe(409);
  expect((await staffRepo.getById(tenant,'editable'))!.permissions).toEqual(['inventory']);
  expect((await req('/staff/owner',{permissions:[],version:1},'PUT')).status).toBe(400);
  expect(await sessionService.validateAndTouchSession(tenant,token)).not.toBeNull();
 });
 it('returns failure when persistence fails and never seeds staff on empty or failed reads',async()=>{
  vi.spyOn(staffRepo,'add').mockRejectedValueOnce(new Error('synthetic write failure'));
  const result=await req('/staff',member('failed'));expect(result.status).toBeGreaterThanOrEqual(400);expect(result.data.success).toBe(false);
  const readSpy=vi.spyOn((staffRepo as any).db,'getSlice').mockResolvedValueOnce([]);
  const previousEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try { expect(await staffRepo.getAll(other)).toEqual([]); }
  finally {process.env.NODE_ENV=previousEnv;readSpy.mockRestore();}

  const repo=new (staffRepo.constructor as any)();vi.spyOn((repo as any).db,'getSlice').mockRejectedValueOnce(new Error('synthetic read failure'));
  await expect(repo.getAll(other)).rejects.toThrow('read failure');
 });
});
