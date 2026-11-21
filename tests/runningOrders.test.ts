import {beforeEach,describe,expect,it,vi} from 'vitest';
import {Database} from '../server/features/shared/database';
import {FinancialTransactionService} from '../server/features/pos/FinancialTransactionService';
import {runningOrderService as service} from '../server/features/pos/RunningOrderService';
import {OrderRepository} from '../server/features/pos/OrderRepository';
import {AuditLogService} from '../server/features/shared/AuditLogService';
import {hashPin} from '../server/features/auth/PinSecurityService';
import {runningTotals,kitchenTickets,matchingBills} from '../shared/runningOrder';
import {toDatabaseRow,fromDatabaseRow} from '../server/features/shared/schema';
const db=Database.getInstance(),orders=new OrderRepository(),financial=FinancialTransactionService.getInstance();
const actor={staffId:'waiter',staffName:'Test Waiter',role:'Waiter',permissions:['orders']};
let tenant:string;
const menu={id:'meal',name:'Meal',price:100,isAvailable:true,category:'Main',isVegetarian:true};
const line=(qty=1,note='')=>({menuItem:menu,quantity:qty,note});
const managerPin='742683';
beforeEach(async()=>{
 tenant=`running-test-${crypto.randomUUID()}`;
 await db.saveObject(tenant,'subscription_v1',{plan:'pro',status:'active',isReadOnly:false,inventoryFrozen:false});
 await db.saveObject(tenant,'settings',{autoDeductStock:true,blockOrdersIfInsufficient:true,gstPercentage:5,maxDiscountPercentage:30,standardDiscountPercentage:5});
 await db.saveSlice(tenant,'menuItems',[menu]);
 await db.saveSlice(tenant,'ingredients',[{id:'flour',name:'Flour',unit:'kg',currentStock:100,minStock:1,costPerUnit:10}]);
 await db.saveSlice(tenant,'recipes',[{menuItemId:'meal',ingredients:[{ingredientId:'flour',quantity:1,unit:'kg'}]}]);
 await db.saveSlice(tenant,'staffList',[{id:'manager',name:'Test Manager',role:'Manager',status:'active',pin:await hashPin(managerPin)}]);
});
const create=async(qty=1,customerId?:string)=>(await financial.executeOrderPlacement(tenant,{id:crypto.randomUUID(),runningOrderFlow:true,items:[line(qty)],status:'Pending',type:'Dine-In',tableNo:'T-01',customerId},actor)).order;
const append=async(order:any,qty=1,operationId=crypto.randomUUID())=>service.append(tenant,order.id,{operationId,expectedVersion:order.running?.billVersion ?? order.version ?? 1,items:[line(qty,'less salt')]},actor);
const pay=(order:any,extra:any={})=>service.settle(tenant,order.id,{expectedVersion:order.running?.billVersion ?? order.version,amount:order.total,paymentMethod:'Cash',cashReceived:1000,discountPercent:0,customDiscount:false,...extra},actor);
describe('Running order and KOT transactions',()=>{
 it('keeps one bill and deducts only new stock across two add-ons',async()=>{
  const first=await create(2),second=await append(first),third=await append(second,2);
  expect((await orders.getAll(tenant))?.length).toBe(1);expect(third.orderNumber).toBe(first.orderNumber);
  expect(third.total).toBe(525);expect(third.items.map(i=>i.quantity)).toEqual([2,1,2]);
  expect(third.running?.batches.map(b=>b.items[0].quantity)).toEqual([2,1,2]);
  expect(kitchenTickets([third]).map(t=>t.items.length)).toEqual([1,1,1]);
  expect((await db.getSlice<any>(tenant,'ingredients'))?.[0].currentStock).toBe(95);
 });
 it('replays the same add-on once and rejects ID reuse with a different payload',async()=>{
  const first=await create(),op=crypto.randomUUID();const next=await append(first,1,op);
  expect((await append(first,1,op)).version).toBe(next.version);
  await expect(append(first,2,op)).rejects.toMatchObject({code:'OPERATION_REUSED'});
  expect((await db.getSlice<any>(tenant,'inventoryMovements'))).toHaveLength(2);
 });
 it('preserves the first menu-price snapshot after a price change',async()=>{
  const first=await create();await db.saveSlice(tenant,'menuItems',[{...menu,price:150}]);
  const next=await service.append(tenant,first.id,{operationId:crypto.randomUUID(),expectedVersion:first.version,items:[{menuItemId:'meal',quantity:1}]},actor);
  expect(next.subtotal).toBe(250);expect(next.items.map(i=>i.menuItem.price)).toEqual([100,150]);
 });
 it('keeps a served KOT served and sends only the new batch to KDS',async()=>{
  let order=await create();const batchId=order.running!.batches[0].id;
  for(const [index,status] of ['Preparing','Ready','Served'].entries())order=await service.batch(tenant,order.id,batchId,status,index+1,actor);
  expect(order.paidAt).toBeUndefined();expect(kitchenTickets([order])).toHaveLength(0);
  order=await append(order);expect(order.running!.batches[0].status).toBe('Served');
  expect(kitchenTickets([order])).toHaveLength(1);expect(kitchenTickets([order])[0].batchNumber).toBe(2);
 });
 it('does not hide an unfinished KOT when a bill is settled early',async()=>{
  const first=await create();const paid=await pay(first);
  expect(paid.order.status).toBe('Completed');expect(kitchenTickets([paid.order])[0].status).toBe('Pending');
  const batch=paid.order.running!.batches[0];const changed=await service.batch(tenant,first.id,batch.id,'Preparing',1,actor);
  expect(changed.status).toBe('Completed');expect(kitchenTickets([changed])[0].status).toBe('Preparing');
 });
 it('requires version checks for concurrent add-ons and settlement',async()=>{
  const first=await create();const results=await Promise.allSettled([append(first),pay(first)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;
  expect(['OPTIMISTIC_LOCK_CONFLICT','ORDER_SEALED']).toContain(rejected.reason.code);
 });
 it('rejects append after settlement, cancellation, or against another tenant',async()=>{
  const first=await create();await pay(first);await expect(append(first)).rejects.toMatchObject({code:'ORDER_SEALED'});
  await expect(service.append(tenant+'-foreign',first.id,{operationId:crypto.randomUUID(),expectedVersion:1,items:[line()]},actor)).rejects.toMatchObject({code:'NOT_FOUND'});
  const second=await create();await financial.executeOrderCancellation(tenant,second.id,{reason:'Test void',cancelledBy:'Owner',staffId:'owner'});
  await expect(append(second)).rejects.toMatchObject({code:'ORDER_SEALED'});
 });
 it('rolls back stock, items, totals and batch metadata if an append fails late',async()=>{
  const first=await create(),spy=vi.spyOn(AuditLogService.getInstance(),'log').mockRejectedValueOnce(new Error('Audit unavailable'));
  try{await expect(append(first)).rejects.toThrow('Audit unavailable');}finally{spy.mockRestore();}
  expect((await orders.getById(tenant,first.id))?.total).toBe(105);expect((await orders.getById(tenant,first.id))?.running?.batches).toHaveLength(1);
  expect((await db.getSlice<any>(tenant,'ingredients'))?.[0].currentStock).toBe(99);
 });
 it('reverses all add-on stock exactly once when the whole unpaid bill is cancelled',async()=>{
  const first=await create(),next=await append(first,2);await financial.executeOrderCancellation(tenant,next.id,{reason:'Test void',cancelledBy:'Owner',staffId:'owner'});
  expect((await db.getSlice<any>(tenant,'ingredients'))?.[0].currentStock).toBe(100);
  expect(kitchenTickets([(await orders.getById(tenant,next.id))!])).toHaveLength(0);
 });
 it('preserves frozen trial totals while allowing kitchen progress and unchanged settlement',async()=>{
  const order=await create();
  await db.saveObject(tenant,'subscription_v1',{plan:'pro',status:'active',isReadOnly:false,inventoryFrozen:false,frozenKots:{[order.id]:{total:order.total,items:order.items,settleUntil:new Date(Date.now()+3600000).toISOString()}}});
  await expect(append(order)).rejects.toMatchObject({code:'FROZEN_KOT'});
  await expect(pay(order,{discountPercent:5,amount:99.75})).rejects.toMatchObject({code:'FROZEN_KOT'});
  const cooking=await service.batch(tenant,order.id,order.running!.batches[0].id,'Preparing',1,actor);
  const paid=await pay(cooking);expect(paid.order.total).toBe(105);
 });
 it('keeps checkout approval valid across kitchen-only status changes',async()=>{
  const order=await create(),version=order.running!.billVersion;
  await service.batch(tenant,order.id,order.running!.batches[0].id,'Preparing',1,actor);
  const paid=await service.settle(tenant,order.id,{expectedVersion:version,amount:105,paymentMethod:'Cash',cashReceived:200,discountPercent:0},actor);
  expect(paid.order.total).toBe(105);
 });
 it('rejects entry-stage discount or immediate payment on running order creation',async()=>{
  for(const extra of [{discount:10},{managerPin},{redeemPoints:true},{paymentMethod:'Cash'},{discountType:'amount',discountValue:20}])
   await expect(financial.executeOrderPlacement(tenant,{runningOrderFlow:true,items:[line()],...extra} as any,actor)).rejects.toMatchObject({code:'SETTLEMENT_ONLY'});
 });
});
describe('Server-authoritative combined checkout',()=>{
 it('applies preset rupees within the staff limit and demands approval above it or for custom amounts',async()=>{
  const first=await append(await create());
  const paid=await pay(first,{discountType:'amount',discountValue:10,amount:199.5});expect(paid.order.total).toBe(199.5);
  const next=await create();
  await expect(pay(next,{discountType:'amount',discountValue:20,amount:84})).rejects.toMatchObject({code:'REASON_REQUIRED'});
  await expect(pay(next,{discountType:'amount',discountValue:1,customDiscount:true,amount:103.95,discountReason:'Custom'})).rejects.toMatchObject({code:'PIN_REQUIRED'});
  const approved=await pay(next,{discountType:'amount',discountValue:20,amount:84,managerPin,discountReason:'Courtesy'});expect(approved.order.running).toMatchObject({discountType:'amount',discountValue:20,manualDiscount:20,approvedBy:'manager'});
 });
 it('enforces the same hard cap, frozen amount, amount validation and atomic rollback for rupee discounts',async()=>{
  const bill=await create();
  await expect(pay(bill,{discountType:'amount',discountValue:31,amount:72.45,managerPin,discountReason:'Over cap'})).rejects.toMatchObject({code:'DISCOUNT_EXCEEDS_MAX_PERCENTAGE'});
  for(const value of [-1,0.335,101,null,'20'])await expect(pay(bill,{discountType:'amount',discountValue:value})).rejects.toMatchObject({code:'INVALID_DISCOUNT'});
  await expect(pay(bill,{discountType:'invalid',discountValue:10})).rejects.toMatchObject({code:'INVALID_DISCOUNT'});
  await expect(pay(bill,{discountType:'amount',discountValue:10,amount:94.49,managerPin,discountReason:'Wrong final'})).rejects.toMatchObject({code:'AMOUNT_CHANGED'});
  expect((await orders.getById(tenant,bill.id))?.total).toBe(105);expect(await db.getSlice(tenant,'payments')).toEqual([]);
  await db.saveObject(tenant,'subscription_v1',{plan:'pro',status:'active',inventoryFrozen:false,isReadOnly:false,frozenKots:{[bill.id]:{total:105,items:bill.items,settleUntil:new Date(Date.now()+3600000).toISOString()}}});
  await expect(pay(bill,{discountType:'amount',discountValue:10,amount:94.5,managerPin,discountReason:'Frozen'})).rejects.toMatchObject({code:'FROZEN_KOT'});
 });
 it('calculates eligible manual discount before GST and collects one final payment',async()=>{
  const order=await append(await create(),1);const totals=runningTotals(200,5,10);
  const result=await pay(order,{amount:totals.total,discountPercent:10,customDiscount:true,managerPin,discountReason:'Test courtesy'});
  expect(result.order).toMatchObject({subtotal:200,discount:20,tax:9,total:189,status:'Completed'});
  expect(result.order.running).toMatchObject({taxableAmount:180,discountPercent:10,approvedBy:'manager'});
  expect(await db.getSlice(tenant,'payments')).toHaveLength(1);
  await expect(pay(result.order)).rejects.toMatchObject({code:'ORDER_SEALED'});
 });
 it('requires approval for custom and above-limit discounts, even for an Owner actor',async()=>{
  const order=await create();
  await expect(pay(order,{discountPercent:10,amount:94.5,managerPin:'999999',discountReason:'Test'})).rejects.toMatchObject({code:'UNAUTHORIZED_PIN'});
  await expect(service.settle(tenant,order.id,{expectedVersion:order.running?.billVersion ?? order.version,discountPercent:2,customDiscount:true,discountReason:'Test',amount:102.9,paymentMethod:'Cash',cashReceived:1000},{...actor,role:'Owner'})).rejects.toMatchObject({code:'PIN_REQUIRED'});
  const paid=await pay(order,{discountPercent:5,amount:99.75});expect(paid.order.total).toBe(99.75);
 });
 it('does not let a PIN override the restaurant hard cap',async()=>{
  const order=await create();await expect(pay(order,{discountPercent:40,amount:63,managerPin,discountReason:'Test'})).rejects.toMatchObject({code:'DISCOUNT_EXCEEDS_MAX_PERCENTAGE'});
 });
 it('rejects stale totals, insufficient cash and invalid discounts without recording payment',async()=>{
  const order=await create();
  await expect(pay(order,{amount:1})).rejects.toMatchObject({code:'AMOUNT_CHANGED'});
  await expect(pay(order,{cashReceived:10})).rejects.toMatchObject({code:'INSUFFICIENT_CASH'});
  await expect(pay(order,{discountPercent:'broken'})).rejects.toMatchObject({code:'INVALID_DISCOUNT'});
  expect(await db.getSlice(tenant,'payments')).toEqual([]);
 });
 it('applies loyalty only once on the combined bill, preserving the post-tax credit rule',async()=>{
  await db.saveSlice(tenant,'customers',[{id:'guest',name:'Guest',loyaltyPoints:20,totalVisits:0,totalSpend:0,lastVisited:''}]);
  const first=await create(1,'guest');expect((await db.getSlice<any>(tenant,'customers'))?.[0].loyaltyPoints).toBe(20);
  const next=await append(first);const paid=await pay(next,{redeemPoints:true,amount:190});
  expect(paid.order.redeemedPoints).toBe(20);expect((await db.getSlice<any>(tenant,'customers'))?.[0]).toMatchObject({loyaltyPoints:2,totalVisits:1,totalSpend:190});
 });
 it('rolls back discount approval, totals and loyalty if final payment fails',async()=>{
  const order=await create();await expect(pay(order,{discountPercent:5,amount:99.75,paymentMethod:'Card'})).rejects.toMatchObject({code:'INVALID_PAYMENT_METHOD'});
  expect((await orders.getById(tenant,order.id))?.running?.manualDiscount).toBeUndefined();expect((await orders.getById(tenant,order.id))?.total).toBe(105);
 });
 it('stores batch metadata in the existing tenant-object transaction and preserves SQL item snapshots',async()=>{
  const order=await append(await create());const saved=fromDatabaseRow('orders',toDatabaseRow('orders',tenant,order));
  expect(saved.items[1].lineId).toBe(order.items[1].lineId);expect(saved.running).toBeUndefined();
  const persisted=await db.getObject<any>(tenant,'running_order_state_v1');expect(persisted[order.id].batches).toHaveLength(2);
  expect(JSON.stringify(persisted)).not.toContain(managerPin);
 });
 it('matches exact table or customer ID without merging by customer name',async()=>{
  const order=await create();expect(matchingBills([order],'Dine-In','t-01','')).toHaveLength(1);
  expect(matchingBills([order],'Takeaway','','same-name')).toHaveLength(0);
 });
});
