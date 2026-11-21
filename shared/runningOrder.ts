import type {Order, KotBatch} from '../src/features/shared/types';

import {money,percentOf,sumMoney,decimalMultiply,isCurrency} from './decimal';
export {money} from './decimal';
export type SettlementDiscount = {type:'percent'|'amount';value:number};
/** Restaurant menu prices are tax-exclusive. Loyalty remains a post-tax credit. */
export function runningTotals(subtotal:number, gstRate:number, percent=0, loyalty=0) {
  return settlementTotals(subtotal,gstRate,{type:'percent',value:percent},loyalty);
}
export function validSettlementDiscount(subtotal:number,discount:SettlementDiscount) {
  return Number.isFinite(discount.value) && discount.value>=0 && (discount.type==='percent'?discount.value<=100:discount.type==='amount'&&isCurrency(discount.value)&&discount.value<=money(subtotal));
}
/** Apply a rupee discount directly, without converting it to an approximate percentage. */
export function settlementTotals(subtotal:number,gstRate:number,discount:SettlementDiscount,loyalty=0) {
  if (![subtotal,gstRate,loyalty].every(Number.isFinite) || subtotal<0 || gstRate<0 || gstRate>30 || loyalty<0 || !validSettlementDiscount(subtotal,discount)) throw new Error('Invalid bill calculation.');
  subtotal=money(subtotal);
  const manualDiscount=discount.type==='amount'?discount.value:percentOf(subtotal,discount.value), taxableAmount=sumMoney([subtotal,-manualDiscount]);
  const tax=percentOf(taxableAmount,gstRate), gross=sumMoney([taxableAmount,tax]);
  const redeemedPoints=money(Math.min(loyalty,gross));
  return {subtotal,manualDiscount,taxableAmount,tax,redeemedPoints,discount:money(manualDiscount+redeemedPoints),total:money(gross-redeemedPoints)};
}
export function discountAboveLimit(subtotal:number,discount:SettlementDiscount,limit:number) {
  return discount.type==='amount'?discount.value>percentOf(subtotal,limit):discount.value>limit;
}
export function openBill(order:Order) {return !order.paidAt && !['Completed','Cancelled'].includes(order.status);}
export function matchingBills(orders:Order[],type:Order['type'],table:string,customerId:string) {
  return orders.filter(o=>openBill(o) && o.type===type && (type==='Dine-In' && table.trim()
    ? o.tableNo?.trim().toLowerCase()===table.trim().toLowerCase()
    : Boolean(customerId) && o.customerId===customerId));
}
/** Batch tickets are projections, never independent payable bills. */
export function kitchenTickets(orders:Order[]):(Order & {parentOrderId?:string;kotBatchId?:string;batchNumber?:number})[] {
 return orders.flatMap(order=>order.running ? order.running.batches.filter(b=>order.status!=='Cancelled' && !['Served','Cancelled'].includes(b.status)).map(b=>({
   ...order,id:`${order.id}:${b.id}`,parentOrderId:order.id,kotBatchId:b.id,batchNumber:b.number,
   items:b.items,status:b.status as Order['status'],date:b.createdAt,servedAt:undefined,version:b.version
 })) : [order]);
}
export function batchProgress(batches:KotBatch[]):Order['status'] {
 const active=batches.filter(b=>!['Served','Cancelled'].includes(b.status));
 return active.some(b=>b.status==='Pending')?'Pending':active.some(b=>b.status==='Preparing')?'Preparing':'Ready';
}
/** Local preview only; server revalidates prices, stock and version on replay. */
export function projectAddon(order:Order, payload:{operationId:string;items:Order['items'];createdAt?:string}) : Order {
 if(order.running?.operations[payload.operationId])return order;
 const items=payload.items.map((i,index)=>({...i,lineId:`oi-${payload.operationId}-${index}`,batchId:payload.operationId}));
 const running=order.running || {gstRate:order.subtotal?money(order.tax/order.subtotal*100):5,batches:[],operations:{}};
 const subtotal=sumMoney([order.subtotal,...items.map(i=>decimalMultiply(i.menuItem.price,i.quantity))]);
 const totals=runningTotals(subtotal,running.gstRate);
 return {...order,items:[...order.items,...items],subtotal,tax:totals.tax,total:totals.total,status:'Pending',servedAt:undefined,version:(order.version || 1)+1,running:{...running,billVersion:(running.billVersion ?? order.version ?? 1)+1,batches:[...running.batches,{id:payload.operationId,number:running.batches.length+1,items,status:'Pending',createdAt:payload.createdAt || order.date,createdBy:order.cashierId,version:1}]}};
}
