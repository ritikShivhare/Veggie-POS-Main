import React,{useEffect,useRef,useState} from 'react';
import {StaffMember} from '../shared/types';
import {ApiClient} from '../shared/services/api';
import {isActiveStaff} from '../shared/staffStatus';

interface Props {tenantId:string;staffList:StaffMember[];currentStaffId:string;onSaved:(staff:StaffMember)=>void;onDeleted:(id:string)=>void;onOwnChange:()=>void;}
const visiblePermissions=['billing','inventory','reports'] as const;
function StaffAccessRow({tenantId,staff,currentStaffId,onSaved,onDeleted,onOwnChange}:Omit<Props,'staffList'> & {staff:StaffMember}) {
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [pin,setPin]=useState(''),[permissions,setPermissions]=useState(staff.permissions.filter(permission=>permission!=='settings')),[version,setVersion]=useState(staff.version || 1);
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[conflict,setConflict]=useState(false);
  useEffect(()=>{if(!dirty){setPermissions(staff.permissions.filter(permission=>permission!=='settings'));setVersion(staff.version || 1);}},[staff.version,staff.permissions,dirty]);
  const refresh=async()=>{
    setBusy(true);setError('');
    try {
      const response=await ApiClient.authenticatedFetch(`/api/staff/${encodeURIComponent(staff.id)}`,{headers:{'x-tenant-id':tenantId}});const result=await response.json();
      if(!response.ok || !result.success || !result.data) throw new Error(result.message || 'Could not load the latest staff record.');
      if(!mounted.current) return;
      onSaved(result.data);setPermissions(result.data.permissions.filter((permission:string)=>permission!=='settings'));setVersion(result.data.version || 1);setPin('');setDirty(false);setConflict(false);setMessage('Latest permissions loaded. Review and enter your changes again.');
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  const save=async()=>{
    if(busy || conflict || !dirty) return;
    setError('');setMessage('');
    if(pin && !/^\d{4,6}$/.test(pin)){setError('Enter a complete 4–6 digit PIN, or leave PIN empty to keep it unchanged.');return;}
    setBusy(true);
    try {
      const response=await ApiClient.authenticatedFetch(`/api/staff/${encodeURIComponent(staff.id)}`,{method:'PUT',headers:{'Content-Type':'application/json','x-tenant-id':tenantId},body:JSON.stringify({version,...(pin?{pin}:{}),...(staff.role!=='Owner'?{permissions:permissions.filter(permission=>permission!=='settings')}:{})})});
      const result=await response.json();
      if(response.status===409){setConflict(true);throw new Error('This staff record changed elsewhere. Load the latest record and review before saving again.');}
      if(!response.ok || !result.success || !result.data) throw new Error(result.message || result.error || 'Staff changes were not saved.');
      if(!mounted.current) return;
      onSaved(result.data);setVersion(result.data.version || 1);setPin('');setDirty(false);setMessage('Staff changes saved.');
      if(staff.id===currentStaffId && pin) onOwnChange();
    }catch(e:any){setError(e.message || 'Could not save staff changes.');}finally{setBusy(false);}
  };
  const remove=async()=>{
    if(busy || staff.role==='Owner' || !window.confirm(`Deactivate ${staff.name}? Historical records will be kept.`)) return;
    setBusy(true);setError('');setMessage('');
    try {
      const response=await ApiClient.authenticatedFetch(`/api/staff/${encodeURIComponent(staff.id)}`,{method:'DELETE',headers:{'x-tenant-id':tenantId}});const result=await response.json();
      if(!response.ok || !result.success) throw new Error(result.message || result.error || 'Staff was not deactivated.');
      if(!mounted.current) return;
      onDeleted(staff.id);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  return <section className="border rounded-xl p-4 space-y-3" aria-label={`Access for ${staff.name}`}>
    <h4 className="font-bold">{staff.name} <span className="text-xs text-slate-500">{staff.role}</span></h4>
    <label className="block text-sm">New PIN for {staff.name}
      <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} disabled={busy} placeholder="Leave blank to keep PIN" onChange={e=>{setPin(e.target.value.replace(/\D/g,'').slice(0,6));setDirty(true);setMessage('');}} className="block border rounded px-2 py-1"/>
    </label>
    <div className="flex flex-wrap gap-3">{visiblePermissions.map(permission=><label key={permission}>
      <input type="checkbox" checked={permissions.includes(permission)} disabled={busy || staff.role==='Owner'} onChange={e=>{setPermissions(p=>e.target.checked?[...p,permission]:p.filter(v=>v!==permission));setDirty(true);setMessage('');}}/> {permission}
    </label>)}</div>
    {staff.role==='Owner' && <p className="text-xs">Owner access is protected. Saving your own new PIN requires signing in again.</p>}
    <button type="button" disabled={!dirty || busy || conflict} onClick={save} className="rounded bg-blue-600 text-white px-3 py-1 disabled:opacity-50">{busy?'Saving…':`Save changes for ${staff.name}`}</button>
    {conflict && <button type="button" disabled={busy} onClick={refresh} className="border rounded px-3 py-1">Load latest record</button>}
    {staff.role!=='Owner' && <button type="button" disabled={busy} onClick={remove} className="ml-3 text-red-700">Deactivate {staff.name}</button>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status" className="text-green-700">{message}</p>}
  </section>;
}
export default function StaffAccessEditor(props:Props) {
  return <div className="space-y-4">{props.staffList.filter(isActiveStaff).map(staff=><StaffAccessRow key={props.tenantId+':'+staff.id} {...props} staff={staff}/>)}</div>;
}
