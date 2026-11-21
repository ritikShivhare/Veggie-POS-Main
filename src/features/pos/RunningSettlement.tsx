import {displayOrderNumber} from '../../../shared/orderNumber';
import React,{useEffect,useRef,useState} from 'react';
import {Order,InventorySettings} from '../shared/types';
import {Dialog} from '../shared/components/ui/Dialog';
import {InputField} from '../shared/components/ui/FormControls';
import {ApiClient} from '../shared/services/api';
import {offlineRepository,OutboxProcessor} from '../shared/services/offline';
import {settlementTotals,validSettlementDiscount,discountAboveLimit} from '../../../shared/runningOrder';
import {isCurrency,decimalMultiply,sumMoney} from '../../../shared/decimal';
import {Banknote,CheckCircle2,Crown} from 'lucide-react';
import QRCode from 'qrcode';

export function RunningSettlement({order,settings,customers,tenantId,tenantVpa,tenantName,onClose,onPaid}:{order:Order;settings:InventorySettings;customers:{id:string;loyaltyPoints:number}[];tenantId:string;tenantVpa?:string;tenantName?:string;onClose:()=>void;onPaid:(order:Order)=>void}) {
 const [discountType,setDiscountType]=useState<'amount'|'percent'>('amount');
 const [preset,setPreset]=useState('0'),[custom,setCustom]=useState(''),[reason,setReason]=useState(''),[pin,setPin]=useState(''),[redeem,setRedeem]=useState(false);
 const [method,setMethod]=useState<'Cash'|'UPI'>('Cash'),[cash,setCash]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[qr,setQr]=useState('');
 const attempt=useRef<{signature:string;key:string}|null>(null),sending=useRef(false);
 const discount={type:discountType,value:Number(preset==='custom'?custom:preset)},points=customers.find(c=>c.id===order.customerId)?.loyaltyPoints || 0;
 const valid=!(preset==='custom'&&!custom.trim())&&validSettlementDiscount(order.subtotal,discount);
 const totals=order.running?.frozen?{subtotal:order.subtotal,manualDiscount:0,taxableAmount:order.subtotal,tax:order.tax,redeemedPoints:order.redeemedPoints||0,discount:order.discount||0,total:order.total}:settlementTotals(order.subtotal,order.running!.gstRate,valid?discount:{type:discountType,value:0},redeem?points:0);
 const approval=valid&&discount.value>0&&(preset==='custom'||discountAboveLimit(order.subtotal,discount,Number(settings.standardDiscountPercentage??0)));
 const aboveHardCap=valid&&Number(settings.maxDiscountPercentage)>0&&discountAboveLimit(order.subtotal,discount,Number(settings.maxDiscountPercentage));
 const cashValid=cash.trim()!==''&&isCurrency(Number(cash))&&Number(cash)>=totals.total;
 const change=isCurrency(Number(cash))&&Number(cash)>=totals.total?sumMoney([Number(cash),-totals.total]):0;
 const chooseDiscount=(value:string)=>{setPreset(value);setPin('');setError('');};
 const chooseDiscountType=(type:'amount'|'percent')=>{setDiscountType(type);setPreset('0');setCustom('');setPin('');setError('');};
 const vpa=(settings.upiVpa || tenantVpa || '').trim();
 useEffect(()=>{if(order.paidAt)onPaid(order);},[order.paidAt]);
 useEffect(()=>{setPin('');setCash('');attempt.current=null;},[order.running?.billVersion ?? order.version]);
 useEffect(()=>{let active=true;setQr('');if(method==='UPI'&&vpa&&vpa!=='veggiepos@upi')QRCode.toDataURL(`upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(settings.upiMerchantName || tenantName || 'Aatmyam Pos')}&am=${totals.total.toFixed(2)}&cu=INR`).then(url=>{if(active)setQr(url);}).catch(()=>{if(active)setError('Could not generate the UPI QR. Check the UPI address in Settings.');});return()=>{active=false};},[method,vpa,totals.total,settings.upiMerchantName,tenantName]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(sending.current)return;setError('');
  if(!valid){setError('Enter a valid discount: 0–100%, or a rupee amount up to the subtotal with at most two decimal places.');return;}
  if(aboveHardCap){setError('Discount exceeds the restaurant hard limit.');return;}
  if(approval&&(!/^\d{4,6}$/.test(pin)||!reason.trim())){setError('Enter the Manager/Owner PIN and discount reason.');return;}
  if(method==='Cash'&&!cashValid){setError('Cash received must cover the final amount, with at most two decimal places.');return;}
  if(method==='UPI'&&(!vpa||vpa==='veggiepos@upi')){setError('Configure your restaurant UPI address first.');return;}
  sending.current=true;setBusy(true);
  try {
   const pending=(await offlineRepository.getAllOutbox(tenantId)).filter(q=>q.entityId===order.id&&!['SYNCED','completed'].includes(q.status));
   if(pending.some(q=>q.endpoint.endsWith('/add-items'))){throw new Error('New KOT items are still syncing. Settle after the bill is confirmed.');}
   if(!navigator.onLine){
    if(discount.value>0||redeem)throw new Error('Discount approval and loyalty redemption need an online connection.');
    await offlineRepository.recordPaymentOffline(tenantId,order.id,{status:'Completed',paymentMethod:method,cashReceived:method==='Cash'?Number(cash):undefined});
    void OutboxProcessor.triggerDrain(tenantId);onClose();return;
   }
   if(pending.length)throw new Error('This bill is still syncing. Please wait before collecting payment.');
   const body={expectedVersion:order.running?.billVersion ?? order.version ?? 1,discountType,discountValue:discount.value,customDiscount:preset==='custom',discountReason:reason,redeemPoints:redeem,managerPin:pin || undefined,paymentMethod:method,cashReceived:method==='Cash'?Number(cash):undefined,amount:totals.total};
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
 const title=`Collect & Settle Bill #${displayOrderNumber(order.orderNumber)}`;
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}} title={title} className="max-w-lg bg-slate-50" headerContent={<p className="flex min-h-11 items-center justify-center gap-2 pl-11 text-sm font-bold text-slate-800"><Crown aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-600"/><span className="break-words">{tenantName || 'Aatmyam Pos'}</span></p>} footer={<button type="submit" form="running-settlement-form" id="running-confirm-payment" disabled={busy||!valid||aboveHardCap} className="min-h-11 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-700 px-4 py-3 font-semibold text-white shadow-sm disabled:opacity-50">{busy?'Confirming payment…':'Settle & Print Receipt'}</button>}>
  <form id="running-settlement-form" onSubmit={submit}>
   <fieldset disabled={busy} className="min-w-0 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold text-slate-900">{title}</h3><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">{order.type}</span>{order.tableNo&&<span className="rounded-md bg-slate-200 px-2 py-1 text-slate-700">Table: {order.tableNo}</span>}</div></div>
   {order.customerName&&<p className="text-xs text-slate-600">Guest: {order.customerName}</p>}
   {order.running?.frozen&&<p className="text-sm text-amber-800">This trial bill keeps its original recorded amount.</p>}
   <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Bill and discount">
    <ul aria-label="All bill items" className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-sm">{order.items.map((i,index)=><li key={i.lineId || index} className="py-2 first:pt-0"><div className="flex justify-between gap-3"><span className="min-w-0 break-words">{i.quantity} × {i.menuItem.name}</span><span className="shrink-0 tabular-nums">₹{decimalMultiply(i.quantity,i.menuItem.price).toFixed(2)}</span></div>{i.note&&<p className="mt-1 text-xs text-slate-500">{i.note}</p>}</li>)}</ul>
    <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold"><span>Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div>
    <fieldset disabled={order.running?.frozen} className="min-w-0 space-y-2">
     <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">Discount ({discountType==='amount'?'₹':'%'})</span><div role="group" aria-label="Discount type" className="inline-flex rounded-full bg-slate-100 p-1">{(['amount','percent'] as const).map(type=><button key={type} type="button" aria-label={type==='amount'?'Discount in rupees':'Discount in percent'} aria-pressed={discountType===type} onClick={()=>chooseDiscountType(type)} className={`min-h-9 min-w-9 rounded-full px-2 text-sm font-bold ${discountType===type?'bg-teal-700 text-white shadow-sm':'text-slate-600'}`}>{type==='amount'?'₹':'%'}</button>)}</div></div>
     <div id="settlement-discount" role="group" aria-label="Discount presets" className="grid grid-cols-5 gap-1.5">{(discountType==='amount'?[0,10,20,30]:[0,5,10,15]).map(value=><button key={value} type="button" aria-pressed={preset===String(value)} onClick={()=>chooseDiscount(String(value))} className={`min-h-11 rounded-full border px-1 text-sm font-semibold ${preset===String(value)?'border-teal-700 bg-teal-700 text-white':'border-slate-200 bg-slate-100 text-slate-700'}`}>{discountType==='amount'?`₹${value}`:`${value}%`}</button>)}<button type="button" aria-pressed={preset==='custom'} onClick={()=>chooseDiscount('custom')} className={`min-h-11 rounded-full border px-1 text-sm font-semibold ${preset==='custom'?'border-teal-700 bg-teal-700 text-white':'border-slate-200 bg-slate-100 text-slate-700'}`}>Custom</button></div>
     {preset==='custom'&&<InputField id="settlement-custom-discount" label={`Custom discount ${discountType==='amount'?'(₹)':'%'}`} type="number" min={0} max={discountType==='amount'?order.subtotal:100} step={discountType==='amount'?'0.01':'any'} required value={custom} onChange={e=>{setCustom(e.target.value);setPin('');}}/>}
     {valid&&totals.manualDiscount>0&&<p className="flex justify-between text-sm text-teal-700"><span>Discount ({discountType==='amount'?'₹':'%'})</span><span>−₹{totals.manualDiscount.toFixed(2)}</span></p>}
     {!valid&&<p role="alert" className="text-xs text-rose-700">{discountType==='amount'?'Enter a rupee discount up to the subtotal, with at most two decimal places.':'Enter a discount from 0 to 100%.'}</p>}
     {aboveHardCap&&<p role="alert" className="text-xs text-rose-700">Discount exceeds the restaurant hard limit ({settings.maxDiscountPercentage}%).</p>}
     <label htmlFor="settlement-reason" className="sr-only">Discount reason</label><input id="settlement-reason" placeholder={approval?'Discount reason (required)':'Discount reason (optional)'} required={approval} value={reason} onChange={e=>setReason(e.target.value)} className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"/>
     {approval&&<InputField id="settlement-manager-pin" label="Approving Manager / Owner PIN" type="password" inputMode="numeric" autoComplete="off" minLength={4} maxLength={6} required value={pin} onChange={e=>setPin(e.target.value)} hint="Approval is required for custom discounts or discounts above the staff limit."/>}
    </fieldset>
   </section>
   {order.customerId&&<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={order.running?.frozen} checked={redeem} onChange={e=>setRedeem(e.target.checked)}/>Use loyalty points (available: {points})</label>}
   <dl className="space-y-1 text-sm tabular-nums">{[['Subtotal',order.subtotal],['Discount',totals.manualDiscount],['Taxable amount',totals.taxableAmount],[`GST (${order.running!.gstRate}%)`,totals.tax],...(totals.redeemedPoints?[['Loyalty credit',totals.redeemedPoints]]:[])].map(([label,value])=><div key={String(label)} className="flex justify-between gap-3"><dt className="text-slate-600">{label}</dt><dd className={label==='Discount'||label==='Loyalty credit'?'font-medium text-teal-700':'font-medium text-slate-800'}>{label==='Discount'||label==='Loyalty credit'?'−':''}₹{Number(value).toFixed(2)}</dd></div>)}</dl>
   <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-bold text-slate-900">Payment Method</h4><p className="flex items-baseline gap-2 text-sm font-medium text-slate-700">Final Amount: <strong data-testid="settlement-final" className="text-lg text-teal-800 tabular-nums">₹{totals.total.toFixed(2)}</strong></p></div>
   <div role="group" aria-label="Payment method" className="grid grid-cols-2 gap-2">{(['Cash','UPI'] as const).map(value=><button key={value} type="button" aria-label={value} aria-pressed={method===value} onClick={()=>{setMethod(value);setError('');}} className={`relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold ${method===value?'border-teal-700 bg-emerald-50 text-teal-800 shadow-sm':'border-slate-200 bg-slate-200/70 text-slate-600'}`}>{value==='Cash'?<Banknote aria-hidden="true" className="h-6 w-6"/>:<span aria-hidden="true" className="text-lg font-black italic">UPI</span>}<span>{value}</span>{method===value&&<CheckCircle2 aria-hidden="true" className="absolute right-2 top-2 h-4 w-4 text-emerald-600"/>}</button>)}</div>
   {method==='Cash'?<><InputField id="settlement-cash" label="Cash Received" type="number" inputMode="decimal" min={0} step="0.01" required value={cash} onChange={e=>setCash(e.target.value)} className="border-teal-300"/><p data-testid="settlement-change" className="text-sm font-medium text-teal-700">Instant Change: ₹{change.toFixed(2)}</p></>:<div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"><p>Collect ₹{totals.total.toFixed(2)} using your restaurant UPI QR.</p>{qr&&<img src={qr} alt={`UPI payment QR for ₹${totals.total.toFixed(2)}`} className="mx-auto h-40 w-40"/>}<p className="break-all text-center font-medium">{vpa && vpa!=='veggiepos@upi'?vpa:'UPI address is not configured'}</p><p className="text-xs text-slate-500">Settle only after confirming that the payment was received.</p></div>}
   </fieldset>
   {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  </form>
 </Dialog>;
}
