import {describe,it,expect,beforeEach,vi} from 'vitest';
import {Database,TransactionRollbackError} from '../server/features/shared/database';
import {syncService,menuRepo,ingredientRepo,settingsRepo} from '../server/context';
const tenant='test-transaction';
let db:Database;
beforeEach(async()=>{db=Database.getInstance();(db as any).tablesByTenant[tenant]={};(db as any).objectsByTenant[tenant]={};await db.saveObject(tenant,"subscription_v1",{plan:"pro",status:"active",isReadOnly:false,inventoryFrozen:false});});
describe('Atomic multi-slice transactions',()=>{
  it('commits menu, ingredients and settings together',async()=>{
    const result=await syncService.saveFullState(tenant,{menuItems:[{id:'meal',name:'Meal',price:100}],ingredients:[{id:'rice',name:'Rice',currentStock:10,costPerUnit:40,minStock:1,unit:'kg'}],settings:{autoDeductStock:true}});
    expect(result.menuItems[0].price).toBe(100);expect(result.ingredients[0].currentStock).toBe(10);expect(result.settings.autoDeductStock).toBe(true);
  });
  it('preserves every slice when a later stage fails',async()=>{
    await menuRepo.saveAll(tenant,[{id:'meal',name:'Original',price:100,version:1}] as any);
    const spy=vi.spyOn(ingredientRepo,'saveAll').mockRejectedValueOnce(new Error('Storage failure'));
    try {await expect(syncService.saveFullState(tenant,{menuItems:[{id:'meal',name:'Changed',price:999,version:1}],ingredients:[{id:'rice',name:'Rice',currentStock:10}]})).rejects.toThrow('Storage failure');}
    finally{spy.mockRestore();}
    expect((await menuRepo.getById(tenant,'meal'))?.name).toBe('Original');expect(await ingredientRepo.getAll(tenant)).toEqual([]);
  });
  it('rolls back explicitly without exposing staged reads after rollback',async()=>{
    await db.saveSlice(tenant,'menuItems',[{id:'meal',name:'Original'}]);
    await expect(db.runTransaction(tenant,async trx=>{await trx.saveSlice('menuItems',[{id:'meal',name:'Changed'}]);await trx.saveObject('settings',{autoDeductStock:true});await trx.rollback();})).rejects.toBeInstanceOf(TransactionRollbackError);
    expect((await menuRepo.getById(tenant,'meal'))?.name).toBe('Original');expect(await settingsRepo.get(tenant)).toBeNull();
  });
  it('prevents a partial commit when settings fail',async()=>{
    await menuRepo.saveAll(tenant,[{id:'meal',name:'Original',price:100,version:1}] as any);
    const spy=vi.spyOn(settingsRepo,'save').mockRejectedValueOnce(new Error('Settings unavailable'));
    try {await expect(syncService.saveFullState(tenant,{menuItems:[{id:'meal',name:'Changed',price:120,version:1}],settings:{autoDeductStock:false}})).rejects.toThrow('Settings unavailable');}finally{spy.mockRestore();}
    expect((await menuRepo.getById(tenant,'meal'))?.price).toBe(100);
  });
});
