import {describe,it,expect,beforeAll,afterAll,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {Database} from '../server/features/shared/database';
import {postgresAdapter} from './postgresAdapter';
import {staffRepo,shiftRepo,syncService,menuRepo,ingredientRepo,recipeRepo,settingsRepo,orderRepo,paymentRepo,inventoryMovementRepo} from '../server/context';
import {financialTransactionService} from '../server/features/pos/FinancialTransactionService';
import {digest} from '../server/features/shared/security';
import {hashPin} from '../server/features/auth/PinSecurityService';
let pg:PGlite,client:any,spy:any;
const tenant='pg-restaurant-a';
describe('PostgreSQL deployment integration',()=>{
  beforeAll(async()=>{
    pg=new PGlite();
    await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
    for(const filename of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort()) await pg.exec(await readFile('migrations/'+filename,'utf8'));
    client=postgresAdapter(pg);spy=vi.spyOn(Database.getInstance(),'getSupabaseClient').mockReturnValue(client);
  },30000);
  afterAll(async()=>{spy?.mockRestore();await pg?.close();});
  it('allows same IDs in two restaurants, and round-trips every financial ledger field',async()=>{
    for(const tid of [tenant,'pg-restaurant-b']) {
      await staffRepo.saveAll(tid,[{id:'owner',name:'Owner',role:'Owner',pin:'98765',permissions:['billing','inventory'],phone:'9000000000',status:'active'}]);
      await menuRepo.saveAll(tid,[{id:'meal',name:'Meal',price:100,category:'Meals',isAvailable:true,isVegetarian:true}]);
      await ingredientRepo.saveAll(tid,[{id:'rice',name:'Rice',unit:'kg',currentStock:10,minStock:1,costPerUnit:40}]);
      await recipeRepo.saveAll(tid,[{menuItemId:'meal',ingredients:[{ingredientId:'rice',quantity:1,unit:'kg'}]}]);
      await settingsRepo.save(tid,{autoDeductStock:true,blockOrdersIfInsufficient:true,managerCanAddPurchases:true,managerCanEditRecipes:true,kdsSoundAlerts:true,quickPinRequired:true,gstPercentage:5});
    }
    const result=await financialTransactionService.executeOrderPlacement(tenant,{id:'order',items:[{menuItemId:'meal',quantity:1}] as any,status:'Completed',paymentMethod:'Cash'},{role:'Owner',staffId:'owner',staffName:'Owner'});
    expect(result.order.total).toBe(105);
    expect((await orderRepo.getById(tenant,'order'))?.items[0].menuItem.name).toBe('Meal');
    expect((await paymentRepo.getAll(tenant))?.[0]).toMatchObject({orderId:'order',paymentMethod:'Cash',cashierId:'owner',amount:105});
    expect((await inventoryMovementRepo.getAll(tenant))?.[0]).toMatchObject({ingredientId:'rice',movementType:'SALE_DEDUCTION',quantityDelta:-1,performedBy:'owner'});
    expect((await ingredientRepo.getById(tenant,'rice'))?.currentStock).toBe(9);
    expect((await ingredientRepo.getById('pg-restaurant-b','rice'))?.currentStock).toBe(10);
    const item=await pg.query<any>(`SELECT order_id,unit_price FROM order_items WHERE tenant_id=$1`,[tenant]);expect(item.rows[0]).toEqual({order_id:'order',unit_price:'100'});
  });
  it('rolls back an order and stock when a deferred foreign key fails',async()=>{
    await expect(financialTransactionService.executeOrderPlacement(tenant,{id:'bad-fk',items:[{menuItemId:'meal',quantity:1}] as any},{role:'Owner',staffId:'alien-staff',staffName:'Unknown'})).rejects.toMatchObject({status:400});
    expect(await orderRepo.getById(tenant,'bad-fk')).toBeNull();
    expect((await ingredientRepo.getById(tenant,'rice'))?.currentStock).toBe(9);
  });
  it('commits settings identically inside and outside a transaction',async()=>{
    await Database.getInstance().runTransaction(tenant,async trx=>{await settingsRepo.save(tenant,{...(await settingsRepo.get(tenant))!,gstPercentage:0,upiVpa:'restaurant@upi'},trx);});
    expect(await settingsRepo.get(tenant)).toMatchObject({gstPercentage:0,upiVpa:'restaurant@upi'});
  });
  it('denies anon/authenticated direct data and the retired arbitrary-table RPC',async()=>{
    for(const role of ['anon','authenticated']) {
      await pg.exec(`SET ROLE ${role};SET request.headers='{"x-tenant-id":"saas-admin"}';`);
      await expect(pg.query('SELECT * FROM ingredients')).rejects.toMatchObject({code:'42501'});
      await expect(pg.query(`SELECT save_multi_slice_transaction($1,$2::jsonb,NULL)`,[tenant,'{"ingredients":[]}'])).rejects.toMatchObject({code:'42501'});
      await expect(pg.query(`SELECT commit_tenant_transaction($1,0,'[]','[]')`,[tenant])).rejects.toMatchObject({code:'42501'});
      await pg.exec('RESET ROLE');
    }
    expect((await ingredientRepo.getById(tenant,'rice'))?.currentStock).toBe(9);
  });
  it('rejects a foreign key whose ID exists only in another tenant',async()=>{
    await expect(pg.query(`INSERT INTO order_items(id,tenant_id,order_id,name,quantity,unit_price,subtotal) VALUES('cross','pg-restaurant-b','order','Invalid',1,1,1)`)).rejects.toMatchObject({code:'23503'});
  });
  it('rejects a stale cross-instance revision without a partial write',async()=>{
    const old=await client.rpc('get_tenant_revision',{p_tenant_id:tenant});
    await ingredientRepo.update(tenant,{...(await ingredientRepo.getById(tenant,'rice'))!,minStock:2});
    const result=await client.rpc('commit_tenant_transaction',{p_tenant_id:tenant,p_expected_revision:Number(old.data),p_changes:[],p_objects:[{key:'should-not-exist',value:{secret:'test'}}]});
    expect(result.error?.code).toBe('PT409');expect(await Database.getInstance().getObject(tenant,'should-not-exist')).toBeNull();
  });
  it('upgrades the old revision guard idempotently without changing RPC privileges or tenant state',async()=>{
    const before=await pg.query<any>("SELECT revision FROM tenant_revisions WHERE tenant_id=$1",[tenant]);
    const aclBefore=await pg.query<any>("SELECT proacl::text FROM pg_proc WHERE oid='public.commit_tenant_transaction(text,bigint,jsonb,jsonb)'::regprocedure");
    // Only restore the legacy function, not the surrounding schema migration.
    const current=await pg.query<any>("SELECT pg_get_functiondef('public.commit_tenant_transaction(text,bigint,jsonb,jsonb)'::regprocedure) AS definition");
    await pg.exec(current.rows[0].definition.replace("ERRCODE='PT409'","ERRCODE='40001'"));
    const filename=(await readdir('supabase/migrations')).find(f=>f.endsWith('_avoid_postgrest_revision_retry_loop.sql'))!;
    const migration=await readFile('supabase/migrations/'+filename,'utf8');
    await pg.exec(migration);await pg.exec(migration);
    const result=await client.rpc('commit_tenant_transaction',{p_tenant_id:tenant,p_expected_revision:-1,p_changes:[],p_objects:[]});
    expect(result.error?.code).toBe('PT409');
    expect((await pg.query<any>("SELECT revision FROM tenant_revisions WHERE tenant_id=$1",[tenant])).rows).toEqual(before.rows);
    expect((await pg.query<any>("SELECT proacl::text FROM pg_proc WHERE oid='public.commit_tenant_transaction(text,bigint,jsonb,jsonb)'::regprocedure")).rows).toEqual(aclBefore.rows);
  });
  it('paginates beyond the Supabase 1000-row default and merges cold-cache updates',async()=>{
    await pg.query(`INSERT INTO customers(id,tenant_id,name,phone) SELECT 'c-'||g,$1,'Customer '||g,'900'||g FROM generate_series(1,1205) g`,[tenant]);
    expect((await Database.getInstance().getSlice(tenant,'customers'))?.length).toBe(1205);
    const updated=await Database.getInstance().updateItem(tenant,'customers','c-1',{name:'Changed'});
    expect(updated).toMatchObject({id:'c-1',name:'Changed',phone:'9001'});
  });
  it('consumes signup once, hashes credentials and rejects concurrent wrong OTPs',async()=>{
    const record={pendingToken:'test-registration',businessName:'PG Cafe',ownerName:'Test Owner',ownerPhone:'9000000001',email:'qa@example.test',region:'India',pin:await hashPin('86420'),passwordHash:'test-hash',codeHash:digest('654321'),attempts:0,createdAt:Date.now(),expiresAt:Date.now()+60000};
    await Database.getInstance().saveObject('saas-admin','signup_challenges_v2',[record]);
    for(let i=0;i<2;i++) expect(await Database.getInstance().registerRestaurant(record.pendingToken,digest('111111'),'pg-signup','new-owner')).toMatchObject({success:false,status:401});
    const first=await Database.getInstance().registerRestaurant(record.pendingToken,digest('654321'),'pg-signup','new-owner');
    const second=await Database.getInstance().registerRestaurant(record.pendingToken,digest('654321'),'pg-duplicate','duplicate-owner');
    expect(first.success).toBe(true);expect(second.tenant.tenantId).toBe('pg-signup');
    expect((await staffRepo.getById('pg-signup','new-owner'))?.pin).not.toBe('86420');
    expect(await staffRepo.getById('pg-duplicate','duplicate-owner')).toBeNull();
  });
  it('removes a staff login without destroying their historical shifts',async()=>{
    await staffRepo.add(tenant,{id:'former-staff',name:'Former employee',role:'Staff',pin:'85431',permissions:['billing']} as any);
    await shiftRepo.add(tenant,{id:'historical-shift',staffId:'former-staff',staffName:'Former employee',role:'Staff',status:'Completed',startTime:new Date().toISOString()} as any);
    const staff=await staffRepo.getById(tenant,'former-staff');
    await syncService.saveFullState(tenant,{deletions:{staffList:[{id:staff.id,version:staff.version}]}});
    expect((await staffRepo.getById(tenant,staff.id)).status).toBe('inactive');
    expect((await shiftRepo.getById(tenant,'historical-shift')).staffId).toBe(staff.id);
  });
});
