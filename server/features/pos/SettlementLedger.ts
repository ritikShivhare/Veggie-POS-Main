import {Database} from '../shared/database';
import {money,sumMoney} from '../../../shared/decimal';
export const SETTLEMENT_LEDGER='settlement_ledger_v1';
export interface RefundEntry {paymentId:string;orderId:string;amount:number;method:string;staffId:string;at:string;}
export async function settlementLedger(tenant:string) {return await Database.getInstance().getObject<{refunds:Record<string,RefundEntry>;tenders:Record<string,{received:number;change:number}>}>(tenant,SETTLEMENT_LEDGER)||{refunds:{},tenders:{}};}
export async function recordTender(tenant:string,paymentId:string,amount:number,received?:number) {
 if(received===undefined)return;const ledger=await settlementLedger(tenant);ledger.tenders[paymentId]={received:money(received),change:sumMoney([received,-amount])};await Database.getInstance().saveObject(tenant,SETTLEMENT_LEDGER,ledger);
}
export async function recordRefunds(tenant:string,refunds:RefundEntry[]) {
 const ledger=await settlementLedger(tenant);for(const refund of refunds)ledger.refunds[refund.paymentId]??=refund;await Database.getInstance().saveObject(tenant,SETTLEMENT_LEDGER,ledger);
}
