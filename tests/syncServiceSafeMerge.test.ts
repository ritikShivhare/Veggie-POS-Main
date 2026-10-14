import {describe,it,expect,beforeEach} from 'vitest';
import {syncService,menuRepo,orderRepo} from '../server/context';
import {Database} from '../server/features/shared/database';
const tenant='management-sync-tests';
beforeEach(()=>{(Database.getInstance() as any).tablesByTenant[tenant]={};(Database.getInstance() as any).objectsByTenant[tenant]={};});
describe('Versioned management sync and financial snapshot protection',()=>{
  it('preserves records omitted from a partial snapshot',async()=>{
    await syncService.saveFullState(tenant,{menuItems:[{id:'a',name:'A',price:100},{id:'b',name:'B',price:200}]});
    await syncService.saveFullState(tenant,{menuItems:[{id:'c',name:'C',price:300}]});
    expect((await menuRepo.getAll(tenant))?.map(i=>i.id).sort()).toEqual(['a','b','c']);
  });
  it('rejects stale versions even with a forged future timestamp',async()=>{
    await syncService.saveFullState(tenant,{menuItems:[{id:'a',name:'A',price:100}]});
    await syncService.saveFullState(tenant,{menuItems:[{id:'a',name:'A',price:120,version:1}]});
    await expect(syncService.saveFullState(tenant,{menuItems:[{id:'a',name:'A',price:1,version:1,updatedAt:'2099-01-01'}]})).rejects.toMatchObject({status:409});
    expect((await menuRepo.getById(tenant,'a'))?.price).toBe(120);
  });
  it('updates a matching version without trusting the client clock',async()=>{
    await syncService.saveFullState(tenant,{menuItems:[{id:'a',name:'A',price:100}]});
    await syncService.saveFullState(tenant,{menuItems:[{id:'a',name:'A',price:110,version:1,updatedAt:'1900-01-01'}]});
    expect(await menuRepo.getById(tenant,'a')).toMatchObject({price:110,version:2});
  });
  it('rejects a financial snapshot without deleting the newer server order',async()=>{
    await orderRepo.saveAll(tenant,[{id:'a',total:100},{id:'b',total:200},{id:'c',total:300}] as any);
    await expect(syncService.saveFullState(tenant,{orders:[{id:'a',total:1},{id:'b',total:1}]})).rejects.toMatchObject({code:'BUSINESS_COMMAND_REQUIRED'});
    expect((await orderRepo.getAll(tenant))?.map(o=>o.id)).toEqual(['a','b','c']);
  });
  it('requires an explicit versioned delete rather than treating absence as deletion',async()=>{
    await syncService.saveFullState(tenant,{menuItems:[{id:'a',name:'A',price:100}]});
    await syncService.saveFullState(tenant,{menuItems:[]});expect(await menuRepo.getById(tenant,'a')).not.toBeNull();
    await expect(syncService.saveFullState(tenant,{deletions:{menuItems:[{id:'a',version:2}]}})).rejects.toMatchObject({status:409});
    await syncService.saveFullState(tenant,{deletions:{menuItems:[{id:'a',version:1}]}});expect(await menuRepo.getById(tenant,'a')).toBeNull();
  });
});
