import {describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';

describe('Upgrade an existing PostgreSQL deployment',()=>{
  it('preserves legacy data and retires header-controlled RPC access',async()=>{
    const pg=new PGlite();
    try {
      await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
      const files=(await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort();
      for(const file of files.filter(f=>f<'008')) {
        const directory=['004_transactions.sql','006_tenant_rls_policies.sql'].includes(file)?'tests/fixtures/legacy-migrations':'migrations';
        await pg.exec(await readFile(directory+'/'+file,'utf8'));
      }
      await pg.exec(`
        INSERT INTO staff(id,tenant_id,name,role,pin,permissions) VALUES('legacy-owner','legacy-a','Owner','Owner','old-hash','["billing"]');
        INSERT INTO menu_items(id,tenant_id,name,price) VALUES('meal','legacy-a','Legacy meal',100);
        INSERT INTO orders(id,tenant_id,"orderNumber",subtotal,total,status,"cashierId") VALUES('old-order','legacy-a','100',100,100,'Completed','legacy-owner');
        INSERT INTO payments(id,tenant_id,order_id,amount,payment_method,status,cashier_id) VALUES('old-payment','legacy-a','old-order',100,'Cash','Completed','legacy-owner');
        INSERT INTO settings(tenant_id,"autoDeductStock") VALUES('legacy-a',false);
        INSERT INTO tenant_objects(tenant_id,key,value) VALUES('legacy-a','settings_extra','{"gstPercentage":0,"upiVpa":"cafe@upi"}');
      `);
      for(const file of files.filter(f=>f>='008')) await pg.exec(await readFile('migrations/'+file,'utf8'));
      expect((await pg.query<any>(`SELECT total FROM orders WHERE tenant_id='legacy-a'`)).rows[0].total).toBe('100');
      expect((await pg.query<any>(`SELECT amount FROM payments WHERE tenant_id='legacy-a'`)).rows[0].amount).toBe('100');
      expect((await pg.query<any>(`SELECT data FROM settings WHERE tenant_id='legacy-a'`)).rows[0].data).toMatchObject({autoDeductStock:false,gstPercentage:0,upiVpa:'cafe@upi'});
      await pg.exec(`INSERT INTO menu_items(id,tenant_id,name,price) VALUES('meal','legacy-b','Other meal',200);`);
      await pg.exec(`SET ROLE service_role`);
      expect((await pg.query<any>(`SELECT deployment_schema_version() AS version`)).rows[0].version).toBe(9);
      expect((await pg.query(`SELECT * FROM menu_items WHERE tenant_id='legacy-a'`)).rows).toHaveLength(1);
      await pg.exec('RESET ROLE');
      for(const role of ['anon','authenticated']) {
        await pg.exec(`SET ROLE ${role};SET request.headers='{"x-tenant-id":"saas-admin"}';`);
        await expect(pg.query(`SELECT save_multi_slice_transaction('legacy-a','{}',NULL)`)).rejects.toMatchObject({code:'42501'});
        await expect(pg.query(`SELECT set_tenant_context('saas-admin')`)).rejects.toMatchObject({code:'42501'});
        await expect(pg.query(`SELECT * FROM staff`)).rejects.toMatchObject({code:'42501'});
        await pg.exec('RESET ROLE');
      }
    }finally{await pg.close();}
  },30000);
});
