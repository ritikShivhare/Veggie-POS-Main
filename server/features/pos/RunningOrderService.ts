import crypto from 'node:crypto';
import {Database,NotFoundError,OptimisticLockConflictError} from '../shared/database';
import {OrderRepository} from './OrderRepository';
import {OrderItemRepository} from './OrderItemRepository';
import {IngredientRepository} from '../inventory/IngredientRepository';
import {InventoryMovementRepository} from '../inventory/InventoryMovementRepository';
import {StaffRepository} from '../staff/StaffRepository';
import {CustomerRepository} from '../crm/CustomerRepository';
import {SettingsRepository} from '../shared/SettingsRepository';
import {POSPricingEngine,FinancialValidationError} from './POSPricingEngine';
import {FinancialTransactionService} from './FinancialTransactionService';
import {findStaffByPinConstantTime} from '../auth/PinSecurityService';
import {isActiveStaff} from '../../../src/features/shared/staffStatus';
import {assertKotMutable,assertSettlement,getSubscription} from '../billing/SubscriptionLifecycle';
import {operationalAlerts} from '../notifications/OperationalAlerts';
import {AuditLogService} from '../shared/AuditLogService';
const auditLogService=AuditLogService.getInstance();
import {saveRunning} from './RunningOrderStore';
import {money,runningTotals,batchProgress,openBill} from '../../../shared/runningOrder';
import type {Order,RunningOrderState} from '../../../src/features/shared/types';

type Actor={staffId:string;staffName:string;role?:string;permissions?:string[]};
const db=Database.getInstance(),orders=new OrderRepository();
const fail=(code:string,message:string)=>new FinancialValidationError(code,message);
function requireVersion(order:Order,version:number) {if(!Number.isInteger(version) || version!==(order.running?.billVersion ?? order.version ?? 1))throw new OptimisticLockConflictError('Bill changed. Refresh before continuing.');}
function requestHash(value:any) {return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
async function stateFor(tenant:string,order:Order):Promise<RunningOrderState> {
 if(order.running)return structuredClone(order.running);
 if(order.discount || order.redeemedPoints)throw fail('LEGACY_DISCOUNT','Settle this previously discounted bill before starting a new running bill.');
 const service=(await db.getObject<any>(tenant,'order_service_state'))?.[order.id];
 const gstRate=order.subtotal?money(order.tax/order.subtotal*100):5;
 return {billVersion:order.version || 1,gstRate,operations:{},batches:[{id:`initial-${order.id}`,number:1,items:order.items,status:service?.servedAt?'Served':order.status as any,createdAt:order.date,createdBy:order.cashierId,servedAt:service?.servedAt,version:1}]};
}
export class RunningOrderService {
 async append(tenant:string,id:string,body:any,actor:Actor) {
  return db.runTransaction(tenant,async trx=>{
   const order=await orders.getById(tenant,id);if(!order)throw new NotFoundError('Bill not found.');
   if(typeof body.operationId!=='string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(body.operationId))throw fail('INVALID_OPERATION','A stable add-on operation ID is required.');
   if(!Array.isArray(body.items)||!body.items.length)throw fail('EMPTY_ORDER','Add at least one item.');
   const state=await stateFor(tenant,order),hash=requestHash(body.items);
   if(state.operations[body.operationId]) {
    if(state.operations[body.operationId]!==hash)throw fail('OPERATION_REUSED','An add-on ID cannot be reused for different items.');
    return order;
   }
   if(!openBill(order))throw fail('ORDER_SEALED','Only an unpaid running bill can receive items.');
   await assertKotMutable(tenant,id);requireVersion(order,body.expectedVersion);
   const calc=await POSPricingEngine.getInstance().validateAndCalculateOrder(tenant,{items:body.items},actor);
   const now=new Date().toISOString(),batchId=body.operationId;
   const lines=calc.validatedItems.map((line,index)=>({...line,id:`oi-${batchId}-${index}`,orderId:id}));
   const items=calc.validatedItems.map((line:any,index:number)=>({lineId:lines[index].id,batchId,menuItem:line.menuItem,menuItemId:line.menuItemId,quantity:line.quantity,note:line.notes}));
   state.batches.push({id:batchId,number:state.batches.length+1,items,status:'Pending',createdAt:now,createdBy:actor.staffId,version:1});state.operations[batchId]=hash;state.billVersion=(state.billVersion ?? order.version ?? 1)+1;
   const totals=runningTotals(money(order.subtotal+calc.subtotal),state.gstRate);
   const updated=await orders.update(tenant,{...order,items:[...order.items,...items],subtotal:totals.subtotal,tax:totals.tax,total:totals.total,status:'Pending',discount:0,earnedPoints:0,redeemedPoints:0,servedAt:undefined},order.version,trx);
   await new OrderItemRepository().saveAll(tenant,[...await new OrderItemRepository().getAll(tenant) || [],...lines],trx);
   if(calc.updatedIngredients.length)await new IngredientRepository().saveAll(tenant,calc.updatedIngredients,trx);
   const movements=calc.inventoryDeductions.map((d,index)=>({id:`mov-${batchId}-${index}`,ingredientId:d.ingredientId,movementType:'SALE_DEDUCTION' as const,quantityDelta:-d.quantityDeducted,previousStock:d.previousStock,newStock:d.newStock,referenceId:id,reason:`Add-on KOT ${state.batches.length}`,performedBy:actor.staffId,created_at:now,version:1}));
   if(movements.length)await new InventoryMovementRepository().saveAll(tenant,[...await new InventoryMovementRepository().getAll(tenant)||[],...movements],trx);
   const served=await db.getObject<any>(tenant,'order_service_state') || {};delete served[id];await db.saveObject(tenant,'order_service_state',served);
   await saveRunning(tenant,id,state);
   await auditLogService.log(tenant,'ORDER_ITEMS_ADDED',actor.staffName,`Added KOT ${state.batches.length} to ${order.orderNumber}`,{orderId:id,batchId,total:totals.total},trx);
   await operationalAlerts.enqueue(tenant,'newOrder',`kot-new:${id}:${batchId}`,`New KOT ${state.batches.length} · ${order.orderNumber}`,`${order.tableNo?`Table ${order.tableNo} · `:''}${items.reduce((sum,i)=>sum+i.quantity,0)} new items.`);
   return {...updated,running:state};
  });
 }
 async batch(tenant:string,id:string,batchId:string,status:string,version:number,actor:Actor) {
  return db.runTransaction(tenant,async trx=>{
   const order=await orders.getById(tenant,id);if(!order)throw new NotFoundError();
   if(order.status==='Cancelled')throw fail('ORDER_CANCELLED','This bill was cancelled.');
   const state=await stateFor(tenant,order),batch=state.batches.find(b=>b.id===batchId);
   if(!batch)throw new NotFoundError('KOT batch not found.');
   if(batch.status===status)return order;
   if(batch.version!==version)throw new OptimisticLockConflictError('KOT changed. Refresh the kitchen screen.');
   if(!({Pending:'Preparing',Preparing:'Ready',Ready:'Served'} as any)[batch.status] || ({Pending:'Preparing',Preparing:'Ready',Ready:'Served'} as any)[batch.status]!==status)throw fail('INVALID_STATUS_TRANSITION','Move this KOT through Preparing, Ready and Served.');
   batch.status=status as any;batch.version++;if(status==='Served')batch.servedAt=new Date().toISOString();
   await saveRunning(tenant,id,state);
   const updated=await orders.update(tenant,{...order,status:order.paidAt?'Completed':batchProgress(state.batches)},order.version,trx);
   if(status==='Served')await operationalAlerts.enqueue(tenant,'orderServed',`kot-served:${id}:${batchId}`,`KOT ${batch.number} served · ${order.orderNumber}`,`Bill remains ${order.paidAt?'settled':'unpaid'}.`);
   await auditLogService.log(tenant,'KOT_STATUS_UPDATED',actor.staffName,`KOT ${batch.number}: ${status}`,{orderId:id,batchId,status},trx);
   return {...updated,running:state,servedAt:state.batches.every(b=>['Served','Cancelled'].includes(b.status))?batch.servedAt:undefined};
  });
 }
 async settle(tenant:string,id:string,body:any,actor:Actor) {
  return db.runTransaction(tenant,async trx=>{
   const order=await orders.getById(tenant,id);if(!order)throw new NotFoundError();
   if(!order.running)throw fail('LEGACY_CHECKOUT','Use the existing checkout for this bill.');
   if(!openBill(order))throw fail('ORDER_SEALED','Bill is already paid or cancelled.');
   await assertSettlement(tenant,id);requireVersion(order,body.expectedVersion);
   const percent=Number(body.discountPercent??0),settings:any=await new SettingsRepository().get(tenant) || {};
   if((await getSubscription(tenant)).frozenKots?.[id] && (percent>0 || body.redeemPoints))throw fail('FROZEN_KOT','Frozen trial bills keep their recorded total. Settle without new discounts or loyalty redemption.');
   if(!Number.isFinite(percent)||percent<0||percent>100)throw fail('INVALID_DISCOUNT','Enter a discount from 0 to 100%.');
   const state=structuredClone(order.running);
   const customer=order.customerId?await new CustomerRepository().getById(tenant,order.customerId):null;
   if(body.redeemPoints && !customer)throw fail('CUSTOMER_REQUIRED','Select a loyalty guest before redeeming points.');
   const totals=runningTotals(order.subtotal,state.gstRate,percent,body.redeemPoints?customer?.loyaltyPoints || 0:0);
   if(Number(settings.maxDiscountPercentage)>0 && percent>settings.maxDiscountPercentage)throw fail('DISCOUNT_EXCEEDS_MAX_PERCENTAGE','Discount exceeds the restaurant hard limit.');
   let approver:any;
   if(percent>0 && (body.customDiscount!==false || percent>Number(settings.standardDiscountPercentage??0))) {
    if(typeof body.discountReason!=='string' || !body.discountReason.trim())throw fail('REASON_REQUIRED','Enter a discount reason.');
    if(typeof body.managerPin!=='string' || !/^\d{4,6}$/.test(body.managerPin))throw fail('PIN_REQUIRED','Enter the approving Manager/Owner PIN.');
    approver=await findStaffByPinConstantTime((await new StaffRepository().getAll(tenant)||[]).filter(s=>isActiveStaff(s)&&['Owner','Manager'].includes(s.role)),body.managerPin);
    if(!approver)throw new FinancialValidationError('UNAUTHORIZED_PIN','Manager/Owner PIN was not accepted.',403);
   } else if(percent>0 && ![0,5,10,15].includes(percent))throw fail('CUSTOM_DISCOUNT','Custom discounts require Manager approval.');
   if(!Number.isFinite(Number(body.amount)) || Math.abs(Number(body.amount)-totals.total)>0.005)throw fail('AMOUNT_CHANGED','The final amount changed. Refresh checkout before collecting payment.');
   if(body.paymentMethod==='Cash' && (!Number.isFinite(Number(body.cashReceived)) || Number(body.cashReceived)<totals.total))throw fail('INSUFFICIENT_CASH','Cash received must cover the final amount.');
   state.billVersion=(state.billVersion ?? order.version ?? 1)+1;state.manualDiscount=totals.manualDiscount;state.discountPercent=percent;state.taxableAmount=totals.taxableAmount;state.approvedBy=approver?.id;
   await saveRunning(tenant,id,state);
   const discounted=await orders.update(tenant,{...order,...totals,earnedPoints:Math.floor(order.subtotal/100),discountReason:percent>0?String(body.discountReason || 'Standard discount'):undefined,authorizerName:approver?.name},order.version,trx);
   if(customer && totals.redeemedPoints)await new CustomerRepository().update(tenant,{...customer,loyaltyPoints:customer.loyaltyPoints-totals.redeemedPoints},customer.version,trx);
   const result=await FinancialTransactionService.getInstance().executeOrderPayment(tenant,id,{amount:totals.total,paymentMethod:body.paymentMethod,transactionReference:typeof body.transactionReference==='string'?body.transactionReference.slice(0,200):undefined,cashierId:actor.staffId,cashierName:actor.staffName});
   await auditLogService.log(tenant,'SETTLEMENT_PRICED',actor.staffName,`Final bill ${order.orderNumber}`,{orderId:id,subtotal:order.subtotal,discount:totals.discount,tax:totals.tax,total:totals.total,approvedBy:approver?.id,version:discounted.version},trx);
   return {...result,order:{...result.order,running:state}};
  });
 }
}
export const runningOrderService=new RunningOrderService();
