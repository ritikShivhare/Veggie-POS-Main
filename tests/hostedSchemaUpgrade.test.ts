import {describe,it,expect,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {Database} from '../server/features/shared/database';
import {postgresAdapter} from './postgresAdapter';
import {staffRepo,settingsRepo} from '../server/context';

async function legacyDatabase() {
  const pg=new PGlite();
  await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
  await pg.exec(await readFile('tests/fixtures/legacy-hosted-schema.sql','utf8'));
  // Supabase grants explicit access as well as PostgreSQL's PUBLIC default.
  await pg.exec(`
    CREATE FUNCTION save_multi_slice_transaction(varchar,jsonb,jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS 'SELECT ''{"success":true}''::jsonb';
    CREATE FUNCTION acquire_tenant_lock(text,text,integer DEFAULT 15) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS 'SELECT true';
    CREATE FUNCTION release_tenant_lock(text,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS 'SELECT true';
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon,authenticated,service_role;
    CREATE TABLE restaurant_sync(id text PRIMARY KEY,data jsonb NOT NULL);
    ALTER TABLE restaurant_sync ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legacy_open_sync ON restaurant_sync FOR ALL USING(true) WITH CHECK(true);
    GRANT ALL ON restaurant_sync TO anon,authenticated,service_role;
  `);
  return pg;
}

describe('Upgrade the observed manually-created hosted schema',()=>{
  it('archives the bounded legacy repair exactly, denies public access, and then upgrades',async()=>{
    const pg=await legacyDatabase();
    try {
      await pg.exec(`INSERT INTO staff(id,tenant_id,name,role,pin) VALUES('owner','legacy','Original owner','Owner','stored-hash');
        INSERT INTO menu_items(id,tenant_id,name,price) VALUES('valid-menu','legacy','Valid meal',120);
        INSERT INTO recipes("menuItemId",tenant_id,ingredients) VALUES('valid-menu','legacy','[]');
        INSERT INTO recipes("menuItemId",tenant_id,ingredients) SELECT 'missing-menu-'||n,'legacy','[{"ingredientId":"missing-stock","quantity":2}]' FROM generate_series(1,13) n;
        INSERT INTO shifts(id,tenant_id,"staffId","staffName",status) VALUES('orphan-shift','legacy','missing-staff','Historical name','Completed'),('valid-shift','legacy','owner','Original owner','Completed');
        INSERT INTO orders(id,tenant_id,"cashierId",total,status) VALUES('original-bill','legacy','owner',120,'Completed');`);
      const originalRecipes=(await pg.query<any>(`SELECT to_jsonb(r) AS original FROM recipes r WHERE "menuItemId"!='valid-menu' ORDER BY "menuItemId"`)).rows.map(r=>r.original);
      const originalShift=(await pg.query<any>(`SELECT to_jsonb(s) AS original FROM shifts s WHERE id='orphan-shift'`)).rows[0].original;
      const sql=await readFile('migrations/manual/archive_invalid_legacy_references.sql','utf8');
      await pg.exec(sql);
      expect((await pg.query<any>(`SELECT record FROM deployment_recovery_archive WHERE source_table='recipes' ORDER BY source_id`)).rows.map(r=>r.record)).toEqual(originalRecipes);
      expect((await pg.query<any>(`SELECT record FROM deployment_recovery_archive WHERE source_table='shifts'`)).rows[0].record).toEqual(originalShift);
      expect((await pg.query(`SELECT * FROM recipes`)).rows).toHaveLength(1);
      expect((await pg.query(`SELECT * FROM shifts`)).rows).toHaveLength(1);
      expect((await pg.query<any>(`SELECT total FROM orders`)).rows[0].total).toBe('120');
      await pg.exec(sql); // Retry moves no additional rows and preserves the archive.
      expect((await pg.query(`SELECT * FROM deployment_recovery_archive`)).rows).toHaveLength(14);
      for(const role of ['anon','authenticated']) {
        await pg.exec(`SET ROLE ${role}`);
        await expect(pg.query(`SELECT * FROM deployment_recovery_archive`)).rejects.toMatchObject({code:'42501'});
        await pg.exec('RESET ROLE');
      }
      await pg.exec(await readFile('migrations/008_deployment_integrity.sql','utf8'));
      await pg.exec(await readFile('migrations/009_atomic_registration.sql','utf8'));
      expect((await pg.query<any>(`SELECT deployment_schema_version() AS version`)).rows[0].version).toBe(9);
      expect((await pg.query(`SELECT * FROM orders`)).rows).toHaveLength(1);
      expect((await pg.query(`SELECT * FROM deployment_recovery_archive`)).rows).toHaveLength(14);
    }finally{await pg.close();}
  },30000);
  it('rejects an unexpected recovery scope without moving records',async()=>{
    const pg=await legacyDatabase();
    try {
      await pg.exec(`INSERT INTO recipes("menuItemId",tenant_id,ingredients) VALUES('unexpected','legacy','[]');`);
      await expect(pg.exec(await readFile('migrations/manual/archive_invalid_legacy_references.sql','utf8'))).rejects.toMatchObject({code:'P0001'});
      await pg.exec('ROLLBACK');
      expect((await pg.query(`SELECT * FROM recipes`)).rows).toHaveLength(1);
      expect((await pg.query<any>(`SELECT to_regclass('public.deployment_recovery_archive') AS archive`)).rows[0].archive).toBeNull();
    }finally{await pg.close();}
  },30000);
  it('hashes nested legacy PIN copies without changing ledger fields or array order',async()=>{
    const pg=await legacyDatabase();
    try {
      // The native pgcrypto/bcryptjs compatibility check is performed separately
      // against hosted PostgreSQL; this stub isolates JSON transformation behavior.
      await pg.exec(`CREATE SCHEMA extensions;
        CREATE FUNCTION extensions.gen_salt(text,integer) RETURNS text LANGUAGE sql AS 'SELECT ''test-salt''';
        CREATE FUNCTION extensions.crypt(text,text) RETURNS text LANGUAGE sql AS 'SELECT ''test-hash:'' || $1';
        INSERT INTO tenant_objects(tenant_id,key,value) VALUES('legacy','global_tenants_list','[{"ownerPin":"86420","name":"Original cafe"}]');
        INSERT INTO restaurant_sync VALUES('legacy','{"staffList":[{"id":"first","pin":"86420"},{"id":"second","pin":"existing-hash"}],"orders":[{"id":"bill","total":120,"status":"Completed"}],"settings":{"managerPin":"1357"},"notes":"86420","empty":[],"nullValue":null}');`);
      const migration=(await readdir('supabase/migrations')).find(f=>f.endsWith('_hash_legacy_json_pins.sql'));
      const sql=await readFile('supabase/migrations/'+migration,'utf8');
      await pg.exec(sql);
      const snapshot:any=(await pg.query<any>(`SELECT data FROM restaurant_sync`)).rows[0].data;
      expect(snapshot).toEqual({staffList:[{id:'first',pin:'test-hash:86420'},{id:'second',pin:'existing-hash'}],orders:[{id:'bill',total:120,status:'Completed'}],settings:{managerPin:'test-hash:1357'},notes:'86420',empty:[],nullValue:null});
      expect((await pg.query<any>(`SELECT value FROM tenant_objects`)).rows[0].value).toEqual([{ownerPin:'test-hash:86420',name:'Original cafe'}]);
      await pg.exec(sql);
      expect((await pg.query<any>(`SELECT data FROM restaurant_sync`)).rows[0].data).toEqual(snapshot);
      expect((await pg.query<any>(`SELECT to_regprocedure('public.hash_legacy_json_pins(jsonb)') AS helper`)).rows[0].helper).toBeNull();
    }finally{await pg.close();}
  },30000);
  it('can restrict legacy public RPCs before the breaking schema upgrade',async()=>{
    const pg=await legacyDatabase();
    try {
      await pg.exec(`INSERT INTO restaurant_sync VALUES('private','{"message":"saved"}');`);
      const migration=(await readdir('supabase/migrations')).find(f=>f.endsWith('_restrict_legacy_public_rpc_access.sql'));
      await pg.exec(await readFile('supabase/migrations/'+migration,'utf8'));
      expect((await pg.query(`SELECT * FROM restaurant_sync`)).rows).toHaveLength(1);
      for(const role of ['anon','authenticated']) {
        await pg.exec(`SET ROLE ${role}`);
        for(const call of ["save_multi_slice_transaction('legacy','{}',NULL)","acquire_tenant_lock('legacy','owner',15)","release_tenant_lock('legacy','owner')"])
          await expect(pg.query('SELECT '+call)).rejects.toMatchObject({code:'42501'});
        await expect(pg.query(`SELECT * FROM restaurant_sync`)).rejects.toMatchObject({code:'42501'});
        await pg.exec('RESET ROLE');
      }
      await pg.exec('SET ROLE service_role');
      expect((await pg.query<any>(`SELECT save_multi_slice_transaction('legacy','{}',NULL) AS result`)).rows[0].result).toEqual({success:true});
      expect((await pg.query(`SELECT * FROM restaurant_sync`)).rows).toHaveLength(1);
    }finally{await pg.close();}
  },30000);
  it('fills missing audit/version columns and preserves legacy settings and owner',async()=>{
    const pg=await legacyDatabase();let spy:any;
    try {
      await pg.exec(`INSERT INTO staff(id,tenant_id,name,role,pin,permissions) VALUES('owner','legacy-tenant','Original owner','Owner','old-hash','["billing"]');INSERT INTO settings(tenant_id,"autoDeductStock") VALUES('legacy-tenant',false);INSERT INTO tenant_objects(tenant_id,key,value) VALUES('legacy-tenant','settings_extra','{"gstPercentage":0}');`);
      await pg.exec(await readFile('migrations/008_deployment_integrity.sql','utf8'));
      await pg.exec(await readFile('migrations/009_atomic_registration.sql','utf8'));
      spy=vi.spyOn(Database.getInstance(),'getSupabaseClient').mockReturnValue(postgresAdapter(pg));
      const settings:any=await settingsRepo.get('legacy-tenant');
      expect(settings).toMatchObject({autoDeductStock:false,gstPercentage:0,version:1});
      await settingsRepo.save('legacy-tenant',{...settings,gstPercentage:5});
      expect(await settingsRepo.get('legacy-tenant')).toMatchObject({gstPercentage:5,version:2});
      await staffRepo.update('legacy-tenant',{id:'owner',phone:'9000000000'} as any,1);
      expect(await staffRepo.getById('legacy-tenant','owner')).toMatchObject({name:'Original owner',phone:'9000000000',version:2});
      expect((await pg.query(`SELECT created_at FROM staff`)).rows).toHaveLength(1);
    }finally{spy?.mockRestore();await pg.close();}
  },30000);
  it('rejects broken historical references without deleting or partially migrating them',async()=>{
    const pg=await legacyDatabase();
    try {
      await pg.exec(`INSERT INTO recipes("menuItemId",tenant_id,ingredients) VALUES('missing-menu','legacy-tenant','[{"ingredientId":"missing-ingredient","quantity":1}]');INSERT INTO shifts(id,tenant_id,"staffId","staffName",status) VALUES('missing-staff-shift','legacy-tenant','missing-staff','Historical staff','Completed');`);
      const [preflight]=await pg.exec(await readFile('migrations/PREFLIGHT.sql','utf8'));
      const counts:any=preflight.rows[0];
      expect(Number(counts.orphan_recipes)).toBe(1);expect(Number(counts.orphan_shifts)).toBe(1);
      expect(Number(counts.orphan_recipe_ingredients)).toBe(1);expect(Number(counts.duplicate_settlements)).toBe(0);
      await expect(pg.exec(await readFile('migrations/008_deployment_integrity.sql','utf8'))).rejects.toMatchObject({code:'23503'});
      await pg.exec('ROLLBACK');
      expect((await pg.query(`SELECT * FROM recipes`)).rows).toHaveLength(1);
      expect((await pg.query(`SELECT * FROM shifts`)).rows).toHaveLength(1);
      expect((await pg.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='staff' AND column_name='created_at'`)).rows).toHaveLength(0);
    }finally{await pg.close();}
  },30000);
});
