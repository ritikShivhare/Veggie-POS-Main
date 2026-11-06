import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { VeggiePOSLocalDatabase } from '../src/features/shared/services/offline/database';
import { OfflineRepository } from '../src/features/shared/services/offline/OfflineRepository';
import { OfflineSyncEngine } from '../src/features/shared/services/offline/OfflineSyncEngine';
import { ApiClient } from '../src/features/shared/services/api';
import Dexie from 'dexie';
let db: VeggiePOSLocalDatabase, repo: OfflineRepository;
describe('Deployment audit: offline invariants', () => {
  beforeEach(async () => {
    db = new VeggiePOSLocalDatabase('audit-' + crypto.randomUUID());
    repo = new OfflineRepository(db);
    ApiClient.setSessionId(null);
    await db.open();
  });
  afterEach(async () => { db.close(); await db.delete(); });
  it('keeps identical entity IDs in two tenants separate', async () => {
    await repo.putMenuItem('tenant-a', { id: 'common-menu-id', name: 'A' });
    await repo.putMenuItem('tenant-b', { id: 'common-menu-id', name: 'B' });
    expect((await repo.getMenuItems('tenant-a')).map(x => x.name)).toEqual(['A']);
  });
  it('protects unsynced local orders when a cloud snapshot is saved', async () => {
    await repo.recordOrderOffline('tenant-a', { id: 'pending-order', items: [], total: 100, status: 'Pending' });
    await repo.saveFullTenantState('tenant-a', { orders: [] });
    expect((await repo.getOrders('tenant-a')).some(x => x.id === 'pending-order')).toBe(true);
  });
  it('resumes auth_error operations after renewed session', async () => {
    const item = await repo.recordOrderOffline('tenant-a', { id: 'auth-order', items: [], total: 100, status: 'Pending' });
    await repo.recordOutboxFailure(item.id, 'Expired', 'auth_error', 0);
    ApiClient.setSessionId('audit-renewed-session');
    await repo.resumeAuthOperations('tenant-a');
    expect((await repo.getPendingOutbox('tenant-a')).length).toBe(1);
  });
  it('requires success JSON rather than treating every 200 as committed', async () => {
    const item = await repo.recordOrderOffline('tenant-a', { id: 'false-success-order', items: [], total: 100, status: 'Pending' });
    const result = await OfflineSyncEngine.processOperation(item, { repository: repo, fetchFn: async () => new Response(JSON.stringify({ success: false, error: 'REJECTED' }), { status: 200 }) });
    expect(result).not.toBe('SYNCED');
  });
  it('does not submit dependent payment while parent order creation is retrying', async () => {
    await repo.recordOrderOffline('tenant-a', { id: 'dependency-order', items: [], total: 100, status: 'Pending' });
    await repo.recordPaymentOffline('tenant-a', 'dependency-order', { status: 'Completed', paymentMethod: 'Cash' });
    const paths: string[] = [];
    await OfflineSyncEngine.syncNow('tenant-a', { repository: repo, fetchFn: async (url: any) => {
      paths.push(String(url));
      return new Response(JSON.stringify({ success: false }), { status: 503 });
    } });
    expect(paths.length).toBe(1);
  });
  it('uses financial payment endpoint for payment settlement', async () => {
    await repo.recordOrderOffline('tenant-a', { id: 'payment-order', items: [], total: 100, status: 'Pending' });
    const item = await repo.recordPaymentOffline('tenant-a', 'payment-order', { status: 'Completed', paymentMethod: 'Cash' });
    expect({ method: item.method, endpoint: item.endpoint }).toEqual({ method: 'POST', endpoint: '/api/orders/payment-order/pay' });
  });
  it('rejects kitchen completion before changing the local order or adding a blocking command', async () => {
    await repo.putOrder('tenant-a', { id: 'ready-order', items: [], total: 10, status: 'Ready' });
    await expect(repo.recordPaymentOffline('tenant-a', 'ready-order', { status: 'Completed' })).rejects.toThrow('cashier settlement');
    expect((await repo.getOrders('tenant-a'))[0].status).toBe('Ready');
    expect(await repo.getAllOutbox('tenant-a')).toHaveLength(0);
  });
  it('preserves a queued payment and releases it after reviewing a rejected legacy kitchen clear', async () => {
    await repo.putOrder('tenant-a', { id: 'legacy-ready', items: [], total: 10, status: 'Ready' });
    const blocked = await repo.enqueueOutbox('tenant-a', {
      entityType: 'order', entityId: 'legacy-ready', operationType: 'UPDATE',
      payload: { status: 'Completed' }, endpoint: '/api/orders/legacy-ready', method: 'PUT',
      idempotencyKey: 'legacy-kitchen-clear'
    });
    await repo.recordOutboxFailure(blocked.id, 'BUSINESS_COMMAND_REQUIRED', 'validation_error', 0);
    await repo.recordPaymentOffline('tenant-a', 'legacy-ready', { status: 'Completed', paymentMethod: 'Cash' });
    const paths: string[] = [];
    const fetchFn = async (url: any) => {
      paths.push(String(url));
      return new Response(JSON.stringify({ success: true, data: {
        id: 'legacy-ready', status: String(url).endsWith('/pay') ? 'Completed' : 'Ready',
        total: 10, paymentMethod: String(url).endsWith('/pay') ? 'Cash' : undefined,
        paidAt: String(url).endsWith('/pay') ? new Date().toISOString() : undefined
      } }), { status: 200 });
    };
    await OfflineSyncEngine.syncNow('tenant-a', { repository: repo, fetchFn });
    expect(paths).toEqual([]);
    await repo.retryOperation('tenant-a', blocked.id, { status: 'Ready', version: 1 });
    await OfflineSyncEngine.syncNow('tenant-a', { repository: repo, fetchFn });
    expect(paths).toEqual(['/api/orders/legacy-ready', '/api/orders/legacy-ready/pay']);
    expect((await repo.getOrders('tenant-a'))[0]).toMatchObject({ status: 'Completed', paymentMethod: 'Cash' });
    expect((await repo.getAllOutbox('tenant-a')).every(item => item.status === 'SYNCED')).toBe(true);
  });
  it('migrates a real v3 database without losing orders or pending commands',async()=>{
    const name='legacy-'+crypto.randomUUID(),legacy=new Dexie(name);
    const schema=Object.fromEntries(['menuItems','ingredients','recipes','staff','orders','orderItems','customers','shifts','settings','outbox','syncMetadata'].map(k=>[k,'id,tenantId']));
    legacy.version(3).stores(schema);await legacy.open();
    await legacy.table('orders').put({id:'old-order',tenantId:'legacy-a',total:100,status:'Pending'});
    await legacy.table('outbox').put({id:'old-command',operationId:'old-command',tenantId:'legacy-a',entityId:'old-order',payload:{total:100},status:'pending'});
    await legacy.table('outbox').put({id:'credential-command',operationId:'credential-command',tenantId:'legacy-a',entityId:'old-discount',payload:{discount:10,managerPin:'12345'},status:'pending'});
    await legacy.table('staff').put({id:'old-owner',tenantId:'legacy-a',name:'Owner',pin:'12345',passwordHash:'private-hash'});
    await legacy.table('settings').bulkPut([{id:'pin-setting',tenantId:'legacy-a',key:'managerPin',value:'12345'},{id:'gst-setting',tenantId:'legacy-a',key:'gstPercentage',value:5}]);
    legacy.close();const migrated=new VeggiePOSLocalDatabase(name);
    try {
      await migrated.open();
      expect((await migrated.orders.get(['legacy-a','old-order'] as any)).total).toBe(100);
      expect((await migrated.outbox.get(['legacy-a','old-command'] as any)).status).toBe('pending');
      const command=await migrated.outbox.get(['legacy-a','credential-command'] as any);expect(command.status).toBe('validation_error');expect(command.payload.managerPin).toBeUndefined();
      const owner:any=await migrated.staff.get(['legacy-a','old-owner'] as any);expect(owner.pin).toBeUndefined();expect(owner.passwordHash).toBeUndefined();
      expect((await migrated.settings.toArray()).map(r=>r.key)).toEqual(['gstPercentage']);
      await migrated.orders.put({id:'old-order',tenantId:'legacy-b',total:200} as any);
      expect((await migrated.orders.get(['legacy-a','old-order'] as any)).total).toBe(100);
      expect(migrated.tables.some(t=>t.name==='orders')).toBe(false);
    }finally{await migrated.delete();}
  });
  it('never saves manager PIN discounts in the durable queue',async()=>{
    await expect(repo.recordOrderOffline('tenant-a',{id:'secret-order',items:[],managerPin:'12345'})).rejects.toThrow('online');
    expect(await repo.getOrders('tenant-a')).toHaveLength(0);expect(await repo.getPendingOutbox('tenant-a')).toHaveLength(0);
  });
});
