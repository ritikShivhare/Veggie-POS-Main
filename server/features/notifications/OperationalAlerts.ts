import crypto from 'node:crypto';
import {Database,OptimisticLockConflictError} from '../shared/database';
import {isActiveStaff} from '../../../src/features/shared/staffStatus';
import {defaultNotificationRules,NotificationRules,OperationalAlert,alertRoles} from '../../../src/features/shared/notificationRules';
import {Ingredient,Order,StaffMember,Shift} from '../../../src/features/shared/types';
import {realtimeService} from '../shared/RealtimeService';
export const RULES_KEY='operational_notification_rules';
export class OperationalAlerts {
 private db=Database.getInstance();
 async rules(tenant:string):Promise<NotificationRules>{return await this.db.getObject<NotificationRules>(tenant,RULES_KEY) || structuredClone(defaultNotificationRules);}
 async saveRules(tenant:string,value:NotificationRules){
  for(const key of ['newOrder','orderServed','lowStock'] as const){const r=value?.[key];if(!r || typeof r.enabled!=='boolean' || !alertRoles.includes(r.role) || !alertRoles.includes(r.fallbackRole))throw Object.assign(new Error('Invalid notification rule.'),{status:400});}
  return this.db.runTransaction(tenant,async()=>{const current=await this.rules(tenant);if(value.version!==current.version)throw new OptimisticLockConflictError('Notification settings changed. Reload before saving.');const clean=(r:any)=>({enabled:r.enabled,role:r.role,fallbackRole:r.fallbackRole});const saved={version:current.version+1,newOrder:clean(value.newOrder),orderServed:clean(value.orderServed),lowStock:clean(value.lowStock)};await this.db.saveObject(tenant,RULES_KEY,saved);return saved;});
 }
 async enqueue(tenant:string,kind:OperationalAlert,key:string,title:string,message:string){
  const rule=(await this.rules(tenant))[kind];if(!rule.enabled)return;
  const staff=((await this.db.getSlice<StaffMember>(tenant,'staffList')) || []).filter(isActiveStaff);
  const shifts=(await this.db.getSlice<Shift>(tenant,'shifts')) || [];
  const onDuty=(s:StaffMember)=>shifts.some(shift=>shift.staffId===s.id && shift.status==='Active' && !shift.endTime);
  let recipients=staff.filter(s=>s.role===rule.role && onDuty(s));
  const fallback=recipients.length===0;
  if(fallback){recipients=staff.filter(s=>s.role===rule.fallbackRole);if(!recipients.length)recipients=staff.filter(s=>s.role==='Owner');}
  const notifications=(await this.db.getObject<any[]>(tenant,'system_notifications')) || [];
  if(notifications.some(n=>n.eventKey===key))return;
  notifications.unshift({id:crypto.randomUUID(),title,message,severity:kind==='lowStock'?'warning':'info',timestamp:new Date().toISOString(),read:false,recipientIds:recipients.map(s=>s.id),readBy:[],dismissedBy:[],eventKey:key,metadata:{kind,fallback}});
  await this.db.saveObject(tenant,'system_notifications',notifications.slice(0,100));
  this.db.afterCommit(()=>realtimeService.broadcastToTenant(tenant,'notifications:updated',{}));
 }
 async newOrder(tenant:string,order:Order){await this.enqueue(tenant,'newOrder',`order-new:${order.id}`,`New order ${order.orderNumber}`,`${order.type}${order.tableNo?` · Table ${order.tableNo}`:''} · ${order.items.reduce((n,i)=>n+i.quantity,0)} items. Open Kitchen (KDS).`);}
 async stock(tenant:string,ingredients:Ingredient[]){
  const state=(await this.db.getObject<Record<string,{low:boolean;sequence:number}>>(tenant,'stock_alert_state')) || {};let changed=false;
  for(const i of ingredients){const low=i.currentStock<=i.minStock,previous=state[i.id];if(previous?.low===low)continue;const sequence=(previous?.sequence || 0)+1;state[i.id]={low,sequence};changed=true;if(low)await this.enqueue(tenant,'lowStock',`stock:${i.id}:${sequence}`,`Reorder: ${i.name}`,`${i.currentStock} ${i.unit} remaining; reorder level ${i.minStock} ${i.unit}.`);}
  if(changed)await this.db.saveObject(tenant,'stock_alert_state',state);
 }
 async serve(tenant:string,id:string,version:number,actor:string){
  return this.db.runTransaction(tenant,async()=>{
   const order=((await this.db.getSlice<Order>(tenant,'orders')) || []).find(o=>o.id===id);
   if(!order)throw Object.assign(new Error('Order not found.'),{status:404});
   const served=(await this.db.getObject<Record<string,any>>(tenant,'order_service_state')) || {};const existing=served[id];if(existing)return existing;
   if(order.status!=='Ready')throw Object.assign(new Error('Mark the order Ready before confirming service.'),{status:400});
   if(!Number.isInteger(version) || version!==(order.version || 1))throw new OptimisticLockConflictError('Order changed. Reload before marking served.');
   const result={orderId:id,servedAt:new Date().toISOString(),servedBy:actor};served[id]=result;await this.db.saveObject(tenant,'order_service_state',served);
   await this.enqueue(tenant,'orderServed',`order-served:${id}`,`Order ${order.orderNumber} served`,`${order.tableNo?`Table ${order.tableNo} · `:''}Served to customer. Review the bill for settlement.`);
   this.db.afterCommit(()=>realtimeService.broadcastSyncUpdate(tenant,'orders'));return result;
  });
 }
}
export const operationalAlerts=new OperationalAlerts();
