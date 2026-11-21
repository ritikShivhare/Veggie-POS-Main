import {displayOrderNumber} from '../../../shared/orderNumber';
import React,{useEffect,useRef,useState} from 'react';
import {Order,InventorySettings} from '../shared/types';
import {Dialog} from '../shared/components/ui/Dialog';
import {InputField} from '../shared/components/ui/FormControls';
import {ApiClient} from '../shared/services/api';
import {offlineRepository,OutboxProcessor} from '../shared/services/offline';
import {runningTotals} from '../../../shared/runningOrder';
import QRCode from 'qrcode';

export function RunningSettlement({order,settings,customers,tenantId,tenantVpa,onClose,onPaid}:{order:Order;settings:InventorySettings;customers:{id:string;loyaltyPoints:number}[];tenantId:string;tenantVpa?:string;onClose:()=>void;onPaid:(order:Order)=>void}) {
 const [preset,setPreset]=useState('0'),[custom,setCustom]=useState(''),[reason,setReason]=useState(''),[pin,setPin]=useState(''),[redeem,setRedeem]=useState(false);
 const [method,setMethod]=useState<'Cash'|'UPI'>('Cash'),[cash,setCash]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[qr,setQr]=useState('');
 const attempt=useRef<{signature:string;key:string}|null>(null),sending=useRef(false);
 const pct=Number(preset==='custom'?custom:preset),points=customers.find(c=>c.id===order.customerId)?.loyaltyPoints || 0;
 const valid=Number.isFinite(pct)&&pct>=0&&pct<=100;
 const totals=order.running?.frozen?{subtotal:order.subtotal,manualDiscount:0,taxableAmount:order.subtotal,tax:order.tax,redeemedPoints:order.redeemedPoints||0,discount:order.discount||0,total:order.total}:runningTotals(order.subtotal,order.running!.gstRate,valid?pct:0,redeem?points:0);
 const approval=pct>0&&(preset==='custom'||pct>Number(settings.standardDiscountPercentage??0));
 const vpa=(settings.upiVpa || tenantVpa || '').trim();
 useEffect(()=>{if(order.paidAt)onPaid(order);},[order.paidAt]);
 useEffect(()=>{setPin('');setCash('');attempt.current=null;},[order.running?.billVersion ?? order.version]);
 useEffect(()=>{let active=true;setQr('');if(method==='UPI'&&vpa)QRCode.toDataURL(`upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(settings.upiMerchantName || 'Aatmyam Pos')}&am=${totals.total.toFixed(2)}&cu=INR`).then(url=>{if(active)setQr(url);});return()=>{active=false};},[method,vpa,totals.total,settings.upiMerchantName]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(sending.current)return;setError('');
  if(!valid){setError('Enter a discount from 0 to 100%.');return;}
  if(approval&&(!/^\d{4,6}$/.test(pin)||!reason.trim())){setError('Enter the Manager/Owner PIN and discount reason.');return;}
  if(method==='Cash'&&(!Number.isFinite(Number(cash))||Number(cash)<totals.total)){setError('Cash received must cover the final amount.');return;}
  if(method==='UPI'&&(!vpa||vpa==='veggiepos@upi')){setError('Configure your restaurant UPI address first.');return;}
  sending.current=true;setBusy(true);
  try {
   const pending=(await offlineRepository.getAllOutbox(tenantId)).filter(q=>q.entityId===order.id&&!['SYNCED','completed'].includes(q.status));
   if(pending.some(q=>q.endpoint.endsWith('/add-items'))){throw new Error('New KOT items are still syncing. Settle after the bill is confirmed.');}
   if(!navigator.onLine){
    if(pct>0||redeem)throw new Error('Discount approval and loyalty redemption need an online connection.');
    await offlineRepository.recordPaymentOffline(tenantId,order.id,{status:'Completed',paymentMethod:method,cashReceived:method==='Cash'?Number(cash):undefined});
    void OutboxProcessor.triggerDrain(tenantId);onClose();return;
   }
   if(pending.length)throw new Error('This bill is still syncing. Please wait before collecting payment.');
   const body={expectedVersion:order.running?.billVersion ?? order.version ?? 1,discountPercent:pct,customDiscount:preset==='custom',discountReason:reason,redeemPoints:redeem,managerPin:pin || undefined,paymentMethod:method,cashReceived:Number(cash),amount:totals.total};
   // Retain a key on uncertain network retries; approval PIN is never persisted.
   const signature=JSON.stringify({...body,managerPin:undefined});
   if(attempt.current?.signature!==signature)attempt.current={signature,key:ApiClient.generateIdempotencyKey('settle-running')};
   const response=await ApiClient.authenticatedFetch(`/api/orders/${encodeURIComponent(order.id)}/pay`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':attempt.current!.key},body:JSON.stringify(body)});
   const result=await response.json();if(!response.ok||!result.success){attempt.current=null;throw new Error(result.message || result.error || 'Payment was not confirmed.');}
   const paid=result.order as Order;
   if(!paid?.paidAt)throw new Error('Server did not confirm a settled bill.');
   await offlineRepository.putOrder(tenantId,paid).catch(console.warn);
   window.dispatchEvent(new CustomEvent('veggiepos_realtime_event',{detail:{tenantId,entityId:paid.id,entityType:'payment'}}));
   onPaid(paid);
  }catch(e:any){setError(e.message);}finally{setPin('');sending.current=false;setBusy(false);}
 };
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}} title={`Collect & Settle Bill #${displayOrderNumber(order.orderNumber)}`} className="max-w-lg">
  <form onSubmit={submit} className="space-y-4">
   <p className="text-sm text-slate-700">{order.type}{order.tableNo?` · Table ${order.tableNo}`:''}{order.customerName?` · ${order.customerName}`:''}</p>
   {order.running?.frozen&&<p className="text-sm text-amber-800">This trial bill keeps its original recorded amount.</p>}
   <ul aria-label="All bill items" className="max-h-48 overflow-y-auto divide-y text-sm">{order.items.map((i,index)=><li key={i.lineId || index} className="py-2"><div className="flex justify-between gap-3"><span>{i.quantity} × {i.menuItem.name}</span><span>₹{(i.quantity*i.menuItem.price).toFixed(2)}</span></div>{i.note&&<p className="text-xs text-slate-600">{i.note}</p>}</li>)}</ul>
   <label className="block text-sm font-semibold">Discount %<select id="settlement-discount" disabled={order.running?.frozen} value={preset} onChange={e=>setPreset(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border p-2">{[0,5,10,15].map(p=><option key={p} value={p}>{p}%</option>)}<option value="custom">Custom percentage</option></select></label>
   {preset==='custom'&&<InputField id="settlement-custom-discount" label="Custom discount %" type="number" min={0} max={100} value={custom} onChange={e=>setCustom(e.target.value)}/>}
   {approval&&<><InputField id="settlement-reason" label="Discount reason" value={reason} onChange={e=>setReason(e.target.value)}/><InputField id="settlement-manager-pin" label="Approving Manager / Owner PIN" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e=>setPin(e.target.value)}/></>}
   {order.customerId&&<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={order.running?.frozen} checked={redeem} onChange={e=>setRedeem(e.target.checked)}/>Use loyalty points (available: {points})</label>}
   <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">{[['Subtotal',order.subtotal],['Discount',totals.manualDiscount],['Taxable amount',totals.taxableAmount],[`GST (${order.running!.gstRate}%)`,totals.tax],['Loyalty credit',totals.redeemedPoints],['Final amount',totals.total]].map(([label,value])=><div key={String(label)} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold" data-testid={label==='Final amount'?'settlement-final':undefined}>₹{Number(value).toFixed(2)}</dd></div>)}</dl>
   <label className="block text-sm font-semibold">Payment method<select aria-label="Payment method" value={method} onChange={e=>setMethod(e.target.value as any)} className="mt-1 min-h-11 w-full rounded-lg border p-2"><option>Cash</option><option>UPI</option></select></label>
   {method==='Cash'?<><InputField id="settlement-cash" label="Cash received" type="number" min={0} step="0.01" value={cash} onChange={e=>setCash(e.target.value)}/><p className="text-sm">Change: ₹{Math.max(0,Number(cash || 0)-totals.total).toFixed(2)}</p></>:<div className="space-y-2 text-sm"><p>Collect the final amount via your restaurant UPI QR.</p>{qr&&<img src={qr} alt={`UPI payment QR for ₹${totals.total.toFixed(2)}`} className="mx-auto h-44 w-44"/>}<p className="break-all">{vpa || 'UPI address is not configured'}</p></div>}
   {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
   <button id="running-confirm-payment" disabled={busy} className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?'Confirming payment…':'Settle & Print Receipt'}</button>
  </form>
 </Dialog>;
}
