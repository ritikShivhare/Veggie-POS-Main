import {OrderRepository} from '../pos/OrderRepository';
import {CustomerRepository} from './CustomerRepository';
export async function updateCustomerBillExtremes(tenant:string,customerId?:string) {
 if(!customerId)return;const repo=new CustomerRepository(),customer=await repo.getById(tenant,customerId);if(!customer)return;
 const bills=(await new OrderRepository().getAll(tenant)||[]).filter(o=>o.customerId===customerId&&o.status==='Completed'&&o.paidAt).map(o=>o.total);
 await repo.update(tenant,{...customer,minBillAmount:bills.length?Math.min(...bills):0,maxBillAmount:bills.length?Math.max(...bills):0});
}
