import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {app} from '../server';
import {Database} from '../server/features/shared/database';
import {postgresAdapter} from './postgresAdapter';
import * as ctx from '../server/context';
import {financialTransactionService as fin} from '../server/features/pos/FinancialTransactionService';
import {runningOrderService} from '../server/features/pos/RunningOrderService';
import {inventoryAccounting} from '../server/features/inventory/InventoryAccounting';
import {runningTotals} from '../shared/runningOrder';
import {money,quantity} from '../shared/decimal';
import {convertRecipeQuantityToIngredientStock} from '../src/features/shared/utils/unitConversion';
import {businessDay,paidSummary,businessWallTime} from '../shared/reporting';

describe('Decimal bill invariants',()=>{
 it('matches exact paise half-up tax for 100,000 prices and preset discounts',()=>{
  for(let cents=1;cents<=100000;cents++){
   const result=runningTotals(cents/100,5);expect(result.tax).toBe(Math.floor((cents*5+50)/100)/100);
  }
  for(let rupees=1;rupees<=1000;rupees++)for(const pct of [5,10,15]){
   const taxable=rupees*100-Math.floor((rupees*100*pct+50)/100),result=runningTotals(rupees,5,pct);
   expect(result.tax).toBe(Math.floor((taxable*5+50)/100)/100);
  }
 });
 it('uses settled dates and separates paid collections, ex-GST sales and average',()=>{
  expect(businessDay('2026-11-20T20:00:00Z')).toBe('2026-11-21');
  expect(businessWallTime('2026-11-20T20:00:00Z').getHours()).toBe(1);
  const summary=paidSummary([{status:'Completed',paidAt:'2026-11-21',total:105,tax:5,paymentMethod:'Cash'},{status:'Pending',total:999},{status:'Cancelled',total:999}] as any);
  expect(summary).toMatchObject({totalRevenue:105,netSales:100,paidCheckouts:1,averagePaidBill:105,cashRevenue:105});
 });
 it('retains small converted quantities until the aggregated stock boundary',()=>{
  expect(convertRecipeQuantityToIngredientStock(0.05,'g','kg')*100).toBe(0.005);
  expect(()=>convertRecipeQuantityToIngredientStock(1,'ml','kg')).toThrow();
  expect(()=>convertRecipeQuantityToIngredientStock(1,'pack','pcs')).toThrow();
 });
});

describe.each(['memory','postgres'])('Financial regression on %s',mode=>{
 let pg:PGlite,spy:any,server:http.Server,base:string,tenant:string,token:string;const db=Database.getInstance();
 const actor={staffId:'owner',staffName:'Synthetic Owner',role:'Owner',permissions:['inventory','orders','billing']};
 const pin='986431'; // isolated synthetic owner only
 const api=async(path:string,body?:any,method=body?'POST':'GET',key=crypto.randomUUID())=>{
  const response=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json','x-session-id':token,'Idempotency-Key':key},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};
 };
 beforeAll(async()=>{
  if(mode==='postgres'){
   pg=new PGlite();await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
   for(const file of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('migrations/'+file,'utf8'));
   spy=vi.spyOn(db,'getSupabaseClient').mockReturnValue(postgresAdapter(pg));
  }
  server=http.createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as any).port}`;
 },30000);
 afterAll(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));spy?.mockRestore();await pg?.close();});
 beforeEach(async()=>{
  tenant='calc-'+crypto.randomUUID();await ctx.saveGlobalTenantsList([...(await ctx.getGlobalTenantsList()),{id:tenant,tenantId:tenant,name:'Synthetic',status:'active'}]);
  await db.saveObject(tenant,'subscription_v1',{plan:'pro',status:'active',inventoryFrozen:false,isReadOnly:false});
  await ctx.settingsRepo.save(tenant,{gstPercentage:5,autoDeductStock:true,blockOrdersIfInsufficient:true,standardDiscountPercentage:15,maxDiscountPercentage:100} as any);
  await ctx.staffRepo.saveAll(tenant,[{...actor,id:'owner',name:actor.staffName,pin,status:'active'}] as any);
  token=(await ctx.sessionService.createSession(tenant,'owner',actor.staffName,'Owner','127.0.0.1','test',actor.permissions)).sessionId;
  await ctx.menuRepo.add(tenant,{id:'meal',name:'Meal',price:100,category:'Main',isAvailable:true} as any);
 });
 const ingredient=async(stock:number,rate:number,unit='kg')=>ctx.ingredientRepo.add(tenant,{id:'flour',name:'Flour',unit,currentStock:stock,minStock:0,costPerUnit:rate});
 const recipe=async(qty:number,unit='kg')=>ctx.recipeRepo.addOrUpdate(tenant,{menuItemId:'meal',ingredients:[{ingredientId:'flour',quantity:qty,unit}]});
 const create=async(id='bill',extra:any={})=>(await fin.executeOrderPlacement(tenant,{id,runningOrderFlow:true,items:[{menuItemId:'meal',quantity:1}],status:'Pending',...extra} as any,actor)).order;
 const purchase=async(qty:number,cost:number,id:string=crypto.randomUUID())=>{const result=await api('/purchases',{id,ingredientId:'flour',quantity:qty,cost});expect(result.status).toBe(200);return ctx.ingredientRepo.getById(tenant,'flour');};
 const pay=async(order:any,body:any={})=>runningOrderService.settle(tenant,order.id,{expectedVersion:order.running.billVersion,discountPercent:0,customDiscount:false,amount:order.total,paymentMethod:'Cash',cashReceived:order.total,...body},actor);
 it.each([[0,0,1000,35,'g',1000,0.035],[10,100,10,0,'kg',20,50],[10,0,10,1000,'kg',20,50]])('preserves purchase value, including zero rates/costs %#',async(stock,rate,qty,cost,unit,expectedStock,expectedRate)=>{
  await ingredient(stock as number,rate as number,unit as string);const saved=await purchase(qty as number,cost as number);expect(saved).toMatchObject({currentStock:expectedStock,costPerUnit:expectedRate});expect(money(saved!.currentStock*saved!.costPerUnit)).toBe(money((stock as number)*(rate as number)+(cost as number)));
 });
 it('preserves quantity precision and does not duplicate a purchase replay',async()=>{
  await ingredient(1.0004,100);await purchase(0.0004,0.04,'same-purchase');const replay=await purchase(0.0004,0.04,'same-purchase');expect(replay!.currentStock).toBe(1.0008);
  const movements=await ctx.inventoryMovementRepo.getAll(tenant);expect(movements).toHaveLength(1);expect(quantity(movements[0].newStock-movements[0].previousStock)).toBe(movements[0].quantityDelta);
 });
 it('rejects incompatible recipe units and changing a historical storage unit',async()=>{
  await ingredient(10,100);expect((await api('/recipes',{menuItemId:'meal',ingredients:[{ingredientId:'flour',quantity:1,unit:'ml'}]})).status).toBe(400);
  const ing=await ctx.ingredientRepo.getById(tenant,'flour');expect((await api('/ingredients/flour',{...ing,unit:'g'},'PUT')).status).toBe(400);
 });
 it('records full required consumption and shortage without inventing physical stock',async()=>{
  await ingredient(0.1,100);await recipe(0.2);await ctx.settingsRepo.save(tenant,{gstPercentage:5,autoDeductStock:true,blockOrdersIfInsufficient:false} as any);await create();
  const issue=Object.values((await inventoryAccounting(tenant)).issues)[0];expect(issue).toMatchObject({required:0.2,issued:0.1,shortage:0.1});expect((await ctx.syncService.getFullState(tenant)).ingredients[0].untrackedConsumption).toBe(0.1);
  await create('second');expect(Object.values((await inventoryAccounting(tenant)).issues)).toHaveLength(2);expect((await ctx.ingredientRepo.getById(tenant,'flour'))!.currentStock).toBe(0);
 });
 it('deducts exactly 5g for 100 tiny 0.05g portions',async()=>{
  await ingredient(1,1000);await recipe(0.05,'g');await create('tiny',{items:[{menuItemId:'meal',quantity:100}]});expect((await ctx.ingredientRepo.getById(tenant,'flour'))!.currentStock).toBe(0.995);
 });
 it('returns recovered quantities at original issue cost after a more expensive purchase',async()=>{
  await ingredient(10,100);await recipe(5);const bill=await create();await purchase(5,1000);
  await fin.executeOrderCancellation(tenant,bill.id,{cancelledBy:actor.staffName,staffId:'owner',reason:'Recover unused material',stockRecovery:{flour:2}});
  const ing=await ctx.ingredientRepo.getById(tenant,'flour');expect(ing!.currentStock).toBe(12);expect(money(ing!.currentStock*ing!.costPerUnit)).toBe(1700);
  expect(Object.values((await inventoryAccounting(tenant)).issues)[0]).toMatchObject({returned:2,wasted:3,unitCost:100});
 });
 it('requires a Manager stock disposition for prepared items and prevents over-restocking',async()=>{
  await ingredient(10,100);await recipe(1);const bill=await create();const batch=bill.running!.batches[0];await runningOrderService.batch(tenant,bill.id,batch.id,'Preparing',batch.version,actor);
  await expect(fin.executeOrderCancellation(tenant,bill.id,{cancelledBy:'Owner',reason:'Prepared'})).rejects.toMatchObject({code:'STOCK_RECOVERY_REQUIRED'});
  await expect(fin.executeOrderCancellation(tenant,bill.id,{cancelledBy:'Owner',reason:'Prepared',stockRecovery:{flour:2}})).rejects.toMatchObject({code:'INVALID_STOCK_RECOVERY'});
  await fin.executeOrderCancellation(tenant,bill.id,{cancelledBy:'Owner',reason:'Waste',stockRecovery:{flour:0}});expect((await ctx.ingredientRepo.getById(tenant,'flour'))!.currentStock).toBe(9);
 });
 it('keeps initial GST, zero-discount checkout and fractional menu validation consistent',async()=>{
  const menu=await ctx.menuRepo.getById(tenant,'meal');await ctx.menuRepo.update(tenant,{...menu!,price:2.3});const bill=await create();expect(bill.tax).toBe(0.12);const paid=await pay(bill);expect(paid.order.total).toBe(bill.total);
  expect((await api('/menu-items',{id:'invalid',name:'Invalid',price:0.335})).status).toBe(400);
 });
 it.each([[120,20,5,105],[53,5.3,2.39,50.09],[333.33,0.01,16.67,349.99]])('settles exact rupee discount and GST without percentage conversion %#',async(price,discount,tax,total)=>{
  const menu=await ctx.menuRepo.getById(tenant,'meal');await ctx.menuRepo.update(tenant,{...menu!,price});const bill=await create();
  const paid=await pay(bill,{discountType:'amount',discountValue:discount,customDiscount:true,managerPin:pin,discountReason:'Approved rupee discount',amount:total,cashReceived:500});
  expect(paid.order).toMatchObject({subtotal:price,discount,tax,total,status:'Completed'});expect(paid.order.running).toMatchObject({discountType:'amount',discountValue:discount});
  expect(paid.payment.amount).toBe(total);expect(await ctx.paymentRepo.getAll(tenant)).toHaveLength(1);
 });
 it('preserves historical frozen trial amounts when monetary rounding rules improve',async()=>{
  const menu=await ctx.menuRepo.getById(tenant,'meal');await ctx.menuRepo.update(tenant,{...menu!,price:2.3});const bill=await create();
  await ctx.orderRepo.update(tenant,{...bill,tax:0.11,total:2.41},bill.version);
  const sub=await db.getObject<any>(tenant,'subscription_v1');await db.saveObject(tenant,'subscription_v1',{...sub,frozenKots:{[bill.id]:{total:2.41,items:bill.items,settleUntil:new Date(Date.now()+3600000).toISOString()}}});
  const frozen=await ctx.orderRepo.getById(tenant,bill.id);const result=await pay(frozen);expect(result.order).toMatchObject({tax:0.11,total:2.41});expect(result.payment.amount).toBe(2.41);
 });
 it('stores correct discounted tax, cash/change, CRM extrema and full refund reversal',async()=>{
  await ctx.customerRepo.add(tenant,{id:'guest',name:'Guest',phone:'9000000001',loyaltyPoints:20,totalSpend:0,totalVisits:0,minBillAmount:0,maxBillAmount:0} as any);
  const bill=await create('guest-bill',{customerId:'guest',items:[{menuItemId:'meal',quantity:4}]});const paid=await pay(bill,{discountPercent:10,redeemPoints:true,amount:358,cashReceived:500});expect(paid.order.total).toBe(358);
  expect(await ctx.customerRepo.getById(tenant,'guest')).toMatchObject({totalSpend:358,totalVisits:1,minBillAmount:358,maxBillAmount:358,loyaltyPoints:4});
  await fin.executeOrderCancellation(tenant,bill.id,{cancelledBy:'Owner',staffId:'owner',reason:'Refund',refundConfirmed:true});expect(await ctx.customerRepo.getById(tenant,'guest')).toMatchObject({totalSpend:0,totalVisits:0,minBillAmount:0,maxBillAmount:0,loyaltyPoints:20});
 });
 it('rejects legacy payment tolerance and forged discount base; preserves loyalty in legacy totals',async()=>{
  const bill=await create('legacy',{runningOrderFlow:false});expect((await api('/orders/legacy/pay',{amount:104.96,paymentMethod:'Cash'})).status).toBe(400);
  expect((await api('/orders/audit-discount',{orderId:bill.id,managerPin:pin,originalAmount:1000,discountAmount:100,finalAmount:900,reason:'Wrong base'})).status).toBe(409);
  await ctx.customerRepo.add(tenant,{id:'guest',name:'Guest',phone:'9000000002',loyaltyPoints:20,totalSpend:0,totalVisits:0,minBillAmount:0,maxBillAmount:0} as any);
  await create('legacy-points',{runningOrderFlow:false,customerId:'guest',redeemPoints:true});expect((await api('/orders/audit-discount',{orderId:'legacy-points',managerPin:pin,originalAmount:85,discountAmount:5,finalAmount:80,reason:'Approved discount'})).status).toBe(200);
  expect(await ctx.orderRepo.getById(tenant,'legacy-points')).toMatchObject({subtotal:100,tax:5,discount:25,total:80,redeemedPoints:20});
 });
 it('subtracts a previous shift cash refund from the current drawer exactly once',async()=>{
  const bill=await create();const paid=await pay(bill);await ctx.paymentRepo.update(tenant,{...paid.payment,created_at:new Date(Date.now()-86400000).toISOString()});
  await ctx.shiftRepo.add(tenant,{id:'shift',staffId:'owner',staffName:'Owner',status:'Active',role:'Owner',startTime:new Date().toISOString(),openingCash:1000} as any);
  await fin.executeOrderCancellation(tenant,bill.id,{cancelledBy:'Owner',staffId:'owner',reason:'Refund now',refundConfirmed:true});const close=await api('/shifts/shift/close-blind',{physicalCashCount:895});expect(close.data).toMatchObject({success:true,expectedCash:895,variance:0});
 });
});
afterAll(()=>ctx.realtimeService.close());
