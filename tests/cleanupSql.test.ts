import {afterAll,beforeAll,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
let pg:PGlite;
beforeAll(async()=>{
 pg=new PGlite();
 await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
 for(const f of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort()) await pg.exec(await readFile('migrations/'+f,'utf8'));
},30000);
afterAll(async()=>{await pg?.close();});
it('clears dummy records including trigger-generated revisions while preserving schema and RLS',async()=>{
 await pg.exec(`INSERT INTO staff(id,tenant_id,name,role) VALUES('owner','test-only','Owner','Owner'); INSERT INTO tenant_objects(tenant_id,key,value) VALUES('test-only','system_active_sessions','[]');`);
 expect((await pg.query<any>('SELECT count(*)::int AS n FROM tenant_revisions')).rows[0].n).toBeGreaterThan(0);
 await pg.exec(await readFile('ops/cleanup-veggi-pos.sql','utf8'));
 expect((await pg.query<any>('SELECT count(*)::int AS n FROM tenant_revisions')).rows[0].n).toBe(0);
 expect((await pg.query<any>('SELECT count(*)::int AS n FROM staff')).rows[0].n).toBe(0);
 expect((await pg.query<any>('SELECT deployment_schema_version() AS version')).rows[0].version).toBe(9);
 expect((await pg.query<any>("SELECT bool_and(rowsecurity) AS secured FROM pg_tables WHERE schemaname='public'")).rows[0].secured).toBe(true);
});
