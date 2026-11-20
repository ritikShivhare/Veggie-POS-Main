import {Database} from '../shared/database';
import type {Order,RunningOrderState} from '../../../src/features/shared/types';
export const RUNNING_KEY='running_order_state_v1';
export async function runningStates(tenant:string) {return await Database.getInstance().getObject<Record<string,RunningOrderState>>(tenant,RUNNING_KEY) || {};}
export async function saveRunning(tenant:string,id:string,state:RunningOrderState) {
 const all=await runningStates(tenant);all[id]=state;await Database.getInstance().saveObject(tenant,RUNNING_KEY,all);
}
export async function initializeRunning(tenant:string,order:Order,actor:string) {
 const settings=await Database.getInstance().getObject<any>(tenant,'settings') || {};
 const state:RunningOrderState={billVersion:order.version || 1,gstRate:Number(settings.gstPercentage??5),operations:{},batches:[{
  id:`initial-${order.id}`,number:1,items:order.items,status:'Pending',createdAt:order.date,createdBy:actor,version:1
 }]};
 await saveRunning(tenant,order.id,state);return state;
}
