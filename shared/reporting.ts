import type {Order} from '../src/features/shared/types';
import {orderBusinessDate} from './orderNumber';
import {money,sumMoney,decimalDivide} from './decimal';
import {openBill} from './runningOrder';
export const isPaidBill=(o:Order)=>o.status==='Completed'&&Boolean(o.paidAt);
export const paidDate=(o:Order)=>o.paidAt || o.date;
export function registerBills(orders:Order[],filter:'unpaid'|'settled'|'all',now=Date.now()) {
 const today=businessDay(now),settled=(o:Order)=>isPaidBill(o)&&Boolean(o.paymentMethod)&&businessDay(paidDate(o))===today;
 return orders.filter(o=>filter==='unpaid'?openBill(o):filter==='settled'?settled(o):openBill(o)||settled(o)||(!o.paidAt&&businessDay(o.date)===today)||businessDay((o as any).cancelledAt)===today);
}
export function businessDay(date:string|number|Date) {return Number.isFinite(new Date(date).getTime())?orderBusinessDate(new Date(date)):'';}
/** Calendar coordinate for reporting ranges, independent of the browser timezone. */
export function businessWallTime(value:string|number|Date=Date.now()) {
 const instant=new Date(value),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant);
 const part=(name:string)=>Number(parts.find(p=>p.type===name)?.value);
 return new Date(part('year'),part('month')-1,part('day'),part('hour'),part('minute'),part('second'),instant.getMilliseconds());
}
export const salesBeforeTax=(o:Pick<Order,'total'|'tax'>)=>sumMoney([o.total,-(o.tax || 0)]);
export function paidSummary(orders:Order[]) {
 const paid=orders.filter(isPaidBill),totalRevenue=sumMoney(paid.map(o=>o.total));
 return {totalRevenue,netSales:sumMoney(paid.map(salesBeforeTax)),cashRevenue:sumMoney(paid.filter(o=>o.paymentMethod==='Cash').map(o=>o.total)),upiRevenue:sumMoney(paid.filter(o=>o.paymentMethod==='UPI').map(o=>o.total)),paidCheckouts:paid.length,averagePaidBill:paid.length?decimalDivide(totalRevenue,paid.length,2):0};
}
