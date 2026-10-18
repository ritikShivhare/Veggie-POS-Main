import React,{useEffect,useState} from 'react';
import {ApiClient} from '../services/api';
import {PLAN_LIMITS} from '../../../../shared/planCatalog';
interface BillingSettingsProps {tenantId:string}
export function BillingSettings({tenantId}:BillingSettingsProps){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const [customer,setCustomer]=useState({name:'',email:'',phone:''}),[selected,setSelected]=useState<string[]>([]);
 const headers=()=>({'Content-Type':'application/json','x-session-id':ApiClient.getSessionId() || ''});
 async function api(path:string,body?:any,key?:string){
  const response=await fetch('/api/billing/'+path+(body===undefined?'?tenantId='+encodeURIComponent(tenantId):''),{method:body===undefined?'GET':'POST',credentials:'include',headers:{...headers(),...(key?{'Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const json=await response.json();if(!response.ok || !json.success) throw new Error(json.message || json.error || 'Request failed. Please retry.');return json;
 }
 async function refresh(){try{setData(await api('subscription'));}catch(e:any){setError(e.message);}}
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
   {sub.staffSelectionRequired && <fieldset className="border rounded p-3"><legend>Choose up to 3 active staff · Owner remains active</legend>
    {data.staffOptions.map((s:any)=><label key={s.id} className="block"><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(e.target.checked?[...selected,s.id]:selected.filter(id=>id!==s.id))} disabled={!selected.includes(s.id) && selected.length>=3}/> {s.name}</label>)}
    <button disabled={!!busy} onClick={()=>action('staff',async()=>{await api('select-staff',{staffIds:selected});})}>Save staff selection</button>
   </fieldset>}
   {!sub.financialReview && <>
    <fieldset className="space-y-2"><legend className="font-semibold">Payment contact</legend>
     {(['name','email','phone'] as const).map(key=><label key={key} className="block text-sm">{key==='phone'?'Indian mobile':key==='name'?'Name':'Email'}<input className="block border rounded p-2 w-full" type={key==='email'?'email':key==='phone'?'tel':'text'} autoComplete={key==='phone'?'tel':key} value={customer[key]} onChange={e=>setCustomer({...customer,[key]:e.target.value})}/></label>)}
    </fieldset>
    <div className="grid sm:grid-cols-3 gap-3">{Object.entries(PLAN_LIMITS).map(([id,plan])=><div className="border rounded p-4 space-y-2" key={id}>
     <h3 className="font-bold">{plan.label}</h3><p className="text-xl">₹{plan.price}{plan.price>0?' / 30 days':''}</p>
     <p>Owner + {plan.staffCount} staff</p><p>{plan.monthlyOrders<0?'Unlimited orders (fair use)':`${plan.monthlyOrders} orders per 30-day cycle`}</p>
     {id!=='free' && <button className="bg-emerald-700 text-white rounded px-3 py-2 disabled:opacity-50" disabled={!!busy || (pending?.status==='CREATING' && pending.plan!==id)} onClick={()=>startCheckout(id)}>{busy===id?'Creating…':pending?.status==='CREATING'?'Recover checkout':'Pay with Cashfree'}</button>}
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
