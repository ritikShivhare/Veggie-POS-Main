import { useEffect, useState } from "react";
import { ApiClient } from "../services/api";
import { displayOrderNumber } from '../../../../shared/orderNumber';

interface AuditEntry {
  id?: string;
  timestamp?: string;
  created_at?: string;
  eventType?: string;
  type?: string;
  actor?: string;
  description?: string;
  details?: { orderNumber?: string; total?: number; amount?: number; paymentMethod?: string };
}

/** Settings → Advanced: owner-only, strictly read-only audit trail. */
export default function OwnerAuditReadOnly({owner,tenantKey}:{owner:boolean;tenantKey:string}) {
  const [rows,setRows]=useState<AuditEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!owner){setLoading(false);return;}
    let active=true;
    setLoading(true);
    ApiClient.authenticatedFetch("/api/events")
      .then(async r=>{if(!r.ok)throw new Error("Unable to load audit history");return r.json();})
      .then(data=>{if(active){if(!data.success)throw new Error("Audit history unavailable");setRows(Array.isArray(data.auditLogs)?data.auditLogs:[]);setError("");}})
      .catch(()=>{if(active)setError("Audit history could not be loaded. Try reopening Advanced.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[owner,tenantKey]);
  if(!owner)return <p role="alert">Only the restaurant Owner may access Advanced settings.</p>;
  return <section className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-xl p-5 space-y-4" aria-label="Owner Events and Audit">
    <h3 className="text-base font-bold text-slate-900">Events &amp; Audit</h3>
    {loading ? <p>Loading audit history…</p> : error ? <p role="alert">{error}</p> : rows.length===0
      ? <p className="text-sm text-slate-500">No audit events recorded yet.</p>
      : <ul className="divide-y divide-slate-100">{rows.map((entry, i) => {
        const instant = entry.timestamp || entry.created_at;
        const date = instant ? new Date(instant) : null;
        const event = (entry.eventType || entry.type || 'Event').toLowerCase().replaceAll('_', ' ');
        return <li key={entry.id || i} className="py-4 space-y-2 text-sm min-w-0">
          <div className="flex flex-wrap justify-between gap-2">
            <strong className="capitalize text-slate-900">{event}</strong>
            <time className="text-xs text-slate-500">{date && Number.isFinite(date.getTime()) ? date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—'}</time>
          </div>
          <p className="text-xs text-slate-600">{entry.actor || '—'}{entry.details?.orderNumber ? ` · Bill #${displayOrderNumber(entry.details.orderNumber)}` : ''}{entry.details?.paymentMethod ? ` · ${entry.details.paymentMethod}` : ''}</p>
          {entry.description && <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-blue-700">View details</summary><p className="mt-2 whitespace-pre-wrap break-words">{entry.description}</p></details>}
        </li>;
      })}</ul>}
  </section>;
}
