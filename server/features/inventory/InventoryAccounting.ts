import {Database} from '../shared/database';
import {decimalMultiply,quantity} from '../../../shared/decimal';
export const INVENTORY_ACCOUNTING='inventory_accounting_v1';
export interface StockIssue {id:string;orderId:string;ingredientId:string;name:string;unit:string;required:number;issued:number;shortage:number;unitCost:number;returned?:number;wasted?:number;closedAt?:string;reconciledAt?:string;shortageWasConsumed?:boolean;}
export async function inventoryAccounting(tenant:string) {return await Database.getInstance().getObject<{issues:Record<string,StockIssue>}>(tenant,INVENTORY_ACCOUNTING)||{issues:{}};}
export async function recordStockIssues(tenant:string,issues:StockIssue[]) {
 const state=await inventoryAccounting(tenant);for(const issue of issues)state.issues[issue.id]??=issue;
 await Database.getInstance().saveObject(tenant,INVENTORY_ACCOUNTING,state);
}
export async function stockShortages(tenant:string) {
 const state=await inventoryAccounting(tenant),byIngredient:Record<string,{ingredientId:string;name:string;unit:string;quantity:number}>={};
 for(const issue of Object.values(state.issues).filter(i=>i.shortage>0&&!i.reconciledAt&&(!i.closedAt||i.shortageWasConsumed))) {
  const row=byIngredient[issue.ingredientId]??={ingredientId:issue.ingredientId,name:issue.name,unit:issue.unit,quantity:0};row.quantity=quantity(row.quantity+issue.shortage);
 }
 return Object.values(byIngredient);
}
export function issueValue(issue:StockIssue,returned:number) {return decimalMultiply(returned,issue.unitCost,12);}
