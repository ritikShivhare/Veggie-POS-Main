import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import 'fake-indexeddb/auto';
import {VeggiePOSLocalDatabase} from '../src/features/shared/services/offline/database';
import {OfflineRepository} from '../src/features/shared/services/offline/OfflineRepository';
let db:VeggiePOSLocalDatabase, repo:OfflineRepository;
const guest={id:'new-guest',name:'Guest',phone:'9876543210',loyaltyPoints:0,totalVisits:0,totalSpend:0};
beforeEach(async()=>{db=new VeggiePOSLocalDatabase('guest-visibility-test');await db.open();repo=new OfflineRepository(db);});
afterEach(async()=>{vi.restoreAllMocks();await db.delete();});
it('keeps a pending guest visible when a stale server snapshot omits it',async()=>{
 await repo.recordCustomerOffline('restaurant-a',guest);
 await repo.saveCustomers('restaurant-a',[]);
 expect((await repo.getCustomers('restaurant-a')).map(item=>item.id)).toEqual(['new-guest']);
 expect(await repo.getCustomers('restaurant-b')).toEqual([]);
});
it('preserves rejected drafts for attention but accepts canonical values after acknowledgement',async()=>{
 const command=await repo.recordCustomerOffline('restaurant-a',guest);
 await repo.recordOutboxFailure(command.id,'Invalid email','validation_error',60000);
 await repo.saveCustomers('restaurant-a',[]);
 expect(await repo.getCustomers('restaurant-a')).toHaveLength(1);
 await repo.updateOutboxStatus(command.id,'SYNCED');
 await repo.saveCustomers('restaurant-a',[{...guest,name:'Canonical guest',version:2}]);
 expect((await repo.getCustomers('restaurant-a'))[0]).toMatchObject({name:'Canonical guest',version:2});
});
it('rolls back the guest if its durable sync command cannot be saved',async()=>{
 vi.spyOn(repo,'enqueueOutbox').mockRejectedValue(new Error('Storage full'));
 await expect(repo.recordCustomerOffline('restaurant-a',guest)).rejects.toThrow('Storage full');
 expect(await repo.getCustomers('restaurant-a')).toEqual([]);
});
