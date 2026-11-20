import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import 'fake-indexeddb/auto';
import {VeggiePOSLocalDatabase} from '../src/features/shared/services/offline/database';
import {OfflineRepository} from '../src/features/shared/services/offline/OfflineRepository';
import {OfflineSyncEngine} from '../src/features/shared/services/offline/OfflineSyncEngine';
import {projectAddon} from '../shared/runningOrder';
let db:VeggiePOSLocalDatabase,repo:OfflineRepository;
const item={menuItem:{id:'meal',name:'Meal',price:100,category:'Main',isVegetarian:true,isAvailable:true},quantity:1};
const order:any={id:'order',orderNumber:'001',date:new Date().toISOString(),type:'Dine-In',tableNo:'T-01',status:'Pending',subtotal:100,tax:5,total:105,items:[item],cashierId:'owner',cashierName:'Owner',version:1,running:{gstRate:5,operations:{},batches:[{id:'initial',number:1,status:'Pending',createdAt:new Date().toISOString(),createdBy:'owner',version:1,items:[item]}]}};
beforeEach(async()=>{db=new VeggiePOSLocalDatabase('running-offline-'+crypto.randomUUID());await db.open();repo=new OfflineRepository(db);await repo.putOrder('a',order);});
afterEach(async()=>{vi.restoreAllMocks();await db.delete();});
it('keeps queued add-ons visible across stale snapshots without rewriting canonical items',async()=>{
 await repo.recordAddonOffline('a',order.id,'operation-1',[item],1);
 await repo.saveOrders('a',[order]);
 expect((await repo.getOrders('a'))[0]).toMatchObject({total:210,version:2});
 expect((await db.orders.get(['a','order']))?.items).toHaveLength(1);
 const restored=new OfflineRepository(db);expect((await restored.getOrders('a'))[0].items).toHaveLength(2);
 expect(await restored.getOrders('b')).toEqual([]);
});
it('preserves FIFO operation IDs and prices across multiple queued add-ons',async()=>{
 const one=await repo.recordAddonOffline('a',order.id,'operation-1',[item],1);
 const two=await repo.recordAddonOffline('a',order.id,'operation-2',[item],2);
 expect(two.clientTimestamp).toBeGreaterThan(one.clientTimestamp);
 expect((await repo.getOrders('a'))[0]).toMatchObject({total:315,version:3});
 expect((await repo.getPendingOutbox('a')).map(q=>q.payload.expectedVersion)).toEqual([1,2]);
});
it('does not double-project an acknowledged batch while a later batch is still pending',async()=>{
 const one=await repo.recordAddonOffline('a',order.id,'operation-1',[item],1);
 await repo.recordAddonOffline('a',order.id,'operation-2',[item],2);
 const canonical=projectAddon(order,{operationId:'operation-1',items:[item]});canonical.running!.operations['operation-1']='hash';
 await repo.updateEntityWithCanonical('a','order',order.id,canonical);
 expect((await repo.getOrders('a'))[0].total).toBe(315);
 await repo.updateOutboxStatus(one.id,'SYNCED');
 expect((await repo.getOrders('a'))[0].items).toHaveLength(3);
});
it('retains failed add-ons for attention and prevents a later payment from bypassing them',async()=>{
 const addon=await repo.recordAddonOffline('a',order.id,'operation-1',[item],1);
 await repo.recordOutboxFailure(addon.id,'Conflict','conflict');
 await repo.recordPaymentOffline('a',order.id,{status:'Completed',paymentMethod:'Cash'});
 const fetchFn=vi.fn();await OfflineSyncEngine.syncNow('a',{repository:repo,fetchFn} as any);
 expect(fetchFn).not.toHaveBeenCalled();expect((await repo.getOrders('a'))[0].paidAt).toBeUndefined();
});
it('does not persist a Manager PIN in any new add-on or zero-discount payment payload',async()=>{
 await repo.recordAddonOffline('a',order.id,'operation-1',[item],1);
 await repo.recordPaymentOffline('a',order.id,{status:'Completed',paymentMethod:'Cash'});
 expect(JSON.stringify(await repo.getAllOutbox('a'))).not.toMatch(/managerPin|password/);
});
