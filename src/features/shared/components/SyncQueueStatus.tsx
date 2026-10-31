import React,{useEffect,useState} from 'react';
import {offlineRepository,OutboxProcessor} from '../services/offline';
import {ApiClient} from '../services/api';
export default function SyncQueueStatus({tenantId}:{tenantId:string}) {
  const [items,setItems]=useState<any[]>([]),[error,setError]=useState('');
  const refresh=async()=>setItems((await offlineRepository.getAllOutbox(tenantId)).filter(i=>!["SYNCED","completed"].includes(i.status)));
  useEffect(()=>{refresh();const timer=setInterval(refresh,5000);return()=>clearInterval(timer);},[tenantId]);
  const retry=async(item:any)=>{
    setError('');try {
      let payload:any;
      const rejectedKitchenClear=item.entityType==='order' && item.method==='PUT' &&
        item.status==='validation_error' && item.payload?.status==='Completed' &&
        !item.payload?.paymentMethod && item.lastError?.includes('BUSINESS_COMMAND_REQUIRED');
      if(rejectedKitchenClear) {
        const response=await ApiClient.authenticatedFetch(item.endpoint);const result=await response.json();
        if(!response.ok || !result.success) throw new Error(result.message || 'Refresh failed.');
        if(result.data.status!=='Ready' || result.data.paidAt) throw new Error('This order is no longer unpaid and Ready. Review it in billing before retrying.');
        if(!window.confirm('The kitchen clear was rejected. Keep this order Ready and retry its queued cashier payment? No payment is discarded.')) return;
        payload={status:'Ready',version:result.data.version};
      } else if(item.method==='PUT' && item.payload?.version!==undefined) {
        const response=await ApiClient.authenticatedFetch(item.endpoint);const result=await response.json();
        if(!response.ok || !result.success) throw new Error(result.message || 'Refresh failed.');
        if(!window.confirm(`The server has version ${result.data.version}. Apply your saved change after reviewing this conflict?`)) return;
        payload={...item.payload,version:result.data.version};
      }
      await offlineRepository.retryOperation(tenantId,item.id,payload);await OutboxProcessor.triggerDrain(tenantId);await refresh();
    }catch(e:any){setError(e.message);}
  };
  if(!items.length) return null;
  return <aside className="border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" aria-live="polite">
    <details><summary className="cursor-pointer font-semibold">{items.length} saved operations awaiting sync</summary>
      <p className="my-2 text-xs">Keep this device’s data until the queue is empty. Failed commands stay saved for review.</p>
      {items.map(item=><div key={item.id} className="flex items-start justify-between gap-3 py-2 border-t border-amber-200">
        <div><b>{item.entityType}: {item.entityId?.slice(-12)}</b><p className="text-xs">{item.status}: {item.lastError || 'Waiting to sync'}</p></div>
        <button onClick={()=>retry(item)} className="shrink-0 rounded border border-amber-400 px-2 py-1 text-xs">Review / retry</button>
      </div>)}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </details>
  </aside>;
}
