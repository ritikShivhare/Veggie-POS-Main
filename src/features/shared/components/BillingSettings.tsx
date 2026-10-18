import React,{useEffect,useState} from 'react';
import {ApiClient} from '../services/api';
import {PLAN_LIMITS} from '../../../../shared/planCatalog';
interface BillingSettingsProps {tenantId:string}
export function BillingSettings({tenantId}:BillingSettingsProps){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [customer,setCustomer]=useState({name:'',email:'',phone:''}),[selected,setSelected]=useState<string[]>([]);
 const headers=()=>({'Content-Type':'application/json','x-session-id':ApiClient.getSessionId() || ''});
 async function api(path:string,body?:any,key?:string){
  const response=await fetch('/api/billing/'+path+(body===undefined?'?tenantId='+encodeURIComponent(tenantId):''),{method:body===undefined?'GET':'POST',credentials:'include',headers:{...headers(),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const json=await response.json();if(!response.ok || !json.success) throw new Error(json.message || json.error || 'Request failed. Please retry.');return json;
 }
 async function refresh(){try{const json=await api('subscription');setData(json);setSelected((json.staffOptions || []).filter((s:any)=>s.status==null || String(s.status).toLowerCase()==='active').map((s:any)=>s.id));}catch(e:any){setError(e.message);}}
 useEffect(()=>{setData(null);setError('');void refresh();},[tenantId]);
 async function action(name:string,work:()=>Promise<void>){setBusy(name);setError('');try{await work();await refresh();}catch(e:any){setError(e.message);await refresh();}finally{setBusy('');}}
 const sub=data?.subscription,usage=data?.usage,limits=data?.limits;
 const pending=data?.links?.find((l:any)=>['ACTIVE','CREATING','CANCEL_PENDING'].includes(l.status));
 const startCheckout=(plan:string)=>action(plan,async()=>{
  const key=pending?.status==='CREATING'?pending.requestId:ApiClient.generateIdempotencyKey('cashfree');
  const result=await api('create-checkout-session',{plan,customer},key);
  if(result.url) window.location.assign(result.url);
 });
 return <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
  <h2 className="text-lg font-bold">Subscription & Billing</h2>
  <p className="text-sm text-slate-600">One outlet. Prices include all subscription charges. Cashfree verifies your payment before access changes.</p>
  {error && <p role="alert" className="bg-rose-50 text-rose-700 p-3 rounded">{error}</p>}
  {!data ? <button onClick={refresh}>Load subscription</button> : <>
   <div className="bg-slate-50 p-4 rounded space-y-1">
    <strong>{sub.trialEndsAt?'14-day trial':PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS]?.label}</strong>
    <p>Owner + {usage.staffCount} / {limits.staffCount} active staff</p>
    <p>{usage.monthlyOrders} / {limits.monthlyOrders<0?'Unlimited (fair use)':limits.monthlyOrders} orders · {usage.openKots} open KOTs{sub.plan==='free'?' / 5':''}</p>
    {sub.plan!=='free' && <p>5 successful AI reports/day · resets at midnight IST</p>}
    <p>Cycle: {new Date(sub.cycleStart).toLocaleDateString()} – {new Date(sub.cycleEnd).toLocaleDateString()}</p>
    {sub.trialEndsAt && <p>Trial ends: {new Date(sub.trialEndsAt).toLocaleString()}</p>}
    {sub.paidUntil && <p>Paid access until: {new Date(sub.paidUntil).toLocaleString()}</p>}
    {sub.inventoryFrozen && <p>Inventory is read-only. Automatic stock deduction is paused.</p>}
    {sub.financialReview && <p role="status" className="text-rose-700">Financial Review: contact support. Your records remain available on Free Starter.</p>}
    {sub.reviewRequired && <p>Trial eligibility needs review. Free Starter is available while support reviews it.</p>}
    {Object.keys(sub.frozenKots || {}).length>0 && <p>Trial KOT items/totals are frozen. Each bill has a 12-hour settlement window from trial expiry.</p>}
   </div>
   {!sub.trialUsed && sub.plan==='free' && <button disabled={!!busy} onClick={()=>action('trial',async()=>{await api('start-trial',{});})} className="border rounded px-4 py-2">Start eligible 14-day trial</button>}
   {sub.plan==='free' && data.staffOptions?.length>0 && <fieldset className="border rounded p-3"><legend>Choose up to 3 active staff · Owner remains active</legend>
    {data.staffOptions.map((s:any)=><label key={s.id} className="block"><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(e.target.checked?[...selected,s.id]:selected.filter(id=>id!==s.id))} disabled={!selected.includes(s.id) && selected.length>=3}/> {s.name}</label>)}
    <p className="text-sm text-slate-600">Cashier/Manager priority keeps up to 3 active staff running after expiry. You can change these selections at any time.</p>
    <button disabled={!!busy} onClick={()=>action('staff',async()=>{await api('select-staff',{staffIds:selected});})}>Save staff selection</button>
   </fieldset>}
   {!!data.expiredFrozenKots?.length && <fieldset className="border rounded p-3 space-y-3"><legend className="font-semibold">Resolve expired trial KOTs · Owner only</legend>
    <p className="text-sm text-slate-600">Settle the original frozen amount after receiving Cash/UPI, or close an unpaid bill with an audit reason. Closing records no payment and makes no stock adjustment.</p>
    {data.expiredFrozenKots.map((kot:any)=><div key={kot.id} className="border rounded p-3 space-y-2">
     <p>{kot.orderNumber} · ₹{kot.total}</p>
     <label className="block text-sm">Audit reason<input aria-label={`Recovery reason for ${kot.orderNumber}`} className="block border rounded p-2 w-full" value={reasons[kot.id] || ''} onChange={e=>setReasons({...reasons,[kot.id]:e.target.value})} minLength={10} maxLength={1000}/></label>
     <div className="flex flex-wrap gap-3">{(['Cash','UPI','close'] as const).map(method=><button key={method} disabled={!!busy || (reasons[kot.id] || '').trim().length<10} className="border rounded px-3 py-2 disabled:opacity-50" onClick={()=>action('kot',async()=>{await api(`frozen-kots/${encodeURIComponent(kot.id)}/recover`,{action:method==='close'?'close':'settle',reason:reasons[kot.id],...(method==='close'?{}:{paymentMethod:method})},ApiClient.generateIdempotencyKey('kot-recovery'));})}>{method==='close'?'Close unpaid':`Received ${method} · settle ₹${kot.total}`}</button>)}</div>
    </div>)}
   </fieldset>}
   {!sub.financialReview && <>
    <fieldset className="space-y-2"><legend className="font-semibold">Payment contact</legend>
     {(['name','email','phone'] as const).map(key=><label key={key} className="block text-sm">{key==='phone'?'Indian mobile':key==='name'?'Name':'Email'}<input className="block border rounded p-2 w-full" type={key==='email'?'email':key==='phone'?'tel':'text'} autoComplete={key==='phone'?'tel':key} value={customer[key]} onChange={e=>setCustomer({...customer,[key]:e.target.value})}/></label>)}
    </fieldset>
    <div className="grid sm:grid-cols-3 gap-3">{Object.entries(PLAN_LIMITS).map(([id,plan])=><div className="border rounded p-4 space-y-2" key={id}>
     <h3 className="font-bold">{plan.label}</h3><p className="text-xl">₹{plan.price}{plan.price>0?' / 30 days':''}</p>
     <p>Owner + {plan.staffCount} staff</p><p>{plan.monthlyOrders<0?'Unlimited orders (fair use)':`${plan.monthlyOrders} orders per 30-day cycle`}</p>
     {id==='enterprise' && sub.plan==='pro' && <p id="elite-upgrade-note" className="text-sm font-medium text-amber-800">Elite upgrade: verified payment starts a fresh 30-day cycle immediately. No proration or credit for unused Pro days.</p>}
     {id!=='free' && <button aria-describedby={id==='enterprise' && sub.plan==='pro'?'elite-upgrade-note':undefined} className="bg-emerald-700 text-white rounded px-3 py-2 disabled:opacity-50" disabled={!!busy || (pending?.status==='CREATING' && pending.plan!==id)} onClick={()=>startCheckout(id)}>{busy===id?'Creating…':pending?.status==='CREATING'?'Recover checkout':'Pay with Cashfree'}</button>}
    </div>)}</div>
    <p className="text-xs text-slate-600">Payment links expire in 60 minutes. A new link cancels the previous pending one. Elite upgrades start a fresh 30-day cycle without proration. Paid renewals within 24 hours of expiry retain the original renewal date.</p>
   </>}
   {!!data.links?.length && <div className="space-y-2"><h3 className="font-semibold">Recent payment links</h3>{data.links.slice(0,10).map((link:any)=><div key={link.id} className="border rounded p-3 text-sm space-y-1">
    <p>{PLAN_LIMITS[link.plan as keyof typeof PLAN_LIMITS]?.label} · ₹{link.amount} · {link.status}</p>
    <p>Expires: {new Date(link.expiresAt).toLocaleString()}</p>
    {!sub.financialReview && link.url && link.status==='ACTIVE' && Date.parse(link.expiresAt)>Date.now() && <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-700 underline mr-4">Open payment link</a>}
    <button disabled={!!busy} className="text-blue-700 underline" onClick={()=>action('check',async()=>{await api('check-payment-status',{linkId:link.id});})}>Check Payment Status</button>
   </div>)}</div>}
  </>}
 </section>;
}
