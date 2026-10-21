import { useEffect, useState } from "react";
import { ApiClient } from "../../../lib/apiClient";

interface AuditEntry {
  id?: string;
  timestamp?: string;
  created_at?: string;
  eventType?: string;
  type?: string;
  actor?: string;
  description?: string;
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
    <p className="text-xs text-slate-600">Read-only history for this restaurant. Event simulation, publishing, and log deletion are unavailable here.</p>
    {loading ? <p>Loading audit history…</p> : error ? <p role="alert">{error}</p> : rows.length===0
      ? <p className="text-sm text-slate-500">No audit events recorded yet.</p>
      : <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead><tr><th className="p-2">Time</th><th className="p-2">Event</th><th className="p-2">Actor</th><th className="p-2">Description</th></tr></thead>
      <tbody>{rows.map((entry,i)=><tr key={entry.id||i} className="border-t border-slate-100"><td className="p-2">{entry.timestamp||entry.created_at||"—"}</td><td className="p-2">{entry.eventType||entry.type||"—"}</td><td className="p-2">{entry.actor||"—"}</td><td className="p-2">{entry.description||"—"}</td></tr>)}</tbody></table></div>}
  </section>;
}
