import React,{useEffect,useRef,useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {StaffMember} from '../shared/types';
import {ApiClient} from '../shared/services/api';
interface Props {
  currentStaff:StaffMember|null;
  setCurrentStaff:(staff:StaffMember|null)=>void;
  setCurrentSessionId:(id:string|null)=>void;
  setActiveTab:(tab:string)=>void;
  setShowAdminPanel:(open:boolean)=>void;
}
export default function SaasAdminLogin(props:Props) {
  const [client]=useState(()=>{
    const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
    return url && key ? createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}) : null;
  });
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState('');
  const [factorId,setFactorId]=useState(''),[qr,setQr]=useState('');
  const [mode,setMode]=useState<'password'|'totp'|'enroll'>('password');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const pendingEnrollment=useRef('');
  useEffect(()=>()=>{
    if(pendingEnrollment.current) client?.auth.mfa.unenroll({factorId:pendingEnrollment.current}).catch(()=>{});
    client?.auth.signOut({scope:'local'}).catch(()=>{});
  },[client]);
  async function reset() {
    if(pendingEnrollment.current) await client?.auth.mfa.unenroll({factorId:pendingEnrollment.current});
    pendingEnrollment.current='';await client?.auth.signOut({scope:'local'});
    setMode('password');setFactorId('');setQr('');setCode('');setPassword('');setError('');
  }
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy) return;
    if(!client){setError('Administrator sign-in is not configured. Contact the system owner.');return;}
    setBusy(true);setError('');
    try {
      if(mode==='password') {
        const {data,error:signInError}=await client.auth.signInWithPassword({email:email.trim(),password});
        setPassword('');if(signInError) throw signInError;
        // A UI check only; the server independently verifies UID, metadata and MFA.
        if(data.user?.app_metadata?.role!=='SUPER_ADMIN') {await client.auth.signOut({scope:'local'});throw new Error('This account is not an approved administrator.');}
        const {data:factors,error:factorError}=await client.auth.mfa.listFactors();
        if(factorError) throw factorError;
        const verified=factors.totp.find(f=>f.status==='verified');
        if(verified) {setFactorId(verified.id);setMode('totp');}
        else {
          // Remove incomplete enrollments left by an interrupted first setup.
          for(const factor of factors.totp.filter(f=>f.status!=='verified')) {
            const result=await client.auth.mfa.unenroll({factorId:factor.id});if(result.error) throw result.error;
          }
          const {data:enrollment,error:enrollError}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Aatmyam SaaS Owner'});
          if(enrollError || !enrollment) throw enrollError || new Error('Authenticator setup failed.');
          pendingEnrollment.current=enrollment.id;setFactorId(enrollment.id);setQr(enrollment.totp.qr_code);setMode('enroll');
        }
      } else {
        if(!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit authenticator code.');
        const {error:verifyError}=await client.auth.mfa.challengeAndVerify({factorId,code});
        if(verifyError) throw verifyError;
        pendingEnrollment.current='';setQr('');
        const {data,error:sessionError}=await client.auth.getSession();
        const token=data.session?.access_token;
        if(sessionError || !token) throw new Error('Sign-in expired. Start again.');
        const response=await fetch('/api/saas-admin/exchange',{method:'POST',headers:{authorization:`Bearer ${token}`},credentials:'include'});
        const result=await response.json();
        if(!response.ok || !result.success || result.user?.role!=='SaaS Owner' || !result.session?.sessionId) throw new Error('Administrator access denied. Verify your approved account and authenticator.');
        await client.auth.signOut({scope:'local'});
        ApiClient.setSessionId(result.session.sessionId);props.setCurrentSessionId(result.session.sessionId);
        props.setCurrentStaff(result.user);props.setActiveTab('saas-admin');props.setShowAdminPanel(true);
      }
    } catch(e:any) {setError(e?.message || 'Authentication failed. Please try again.');}
    finally {setBusy(false);}
  }
  return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
    <div className="w-full max-w-md rounded-3xl bg-slate-900 p-8 border border-slate-700">
      <h1 className="text-xl font-bold">Aatmyam POS administrator</h1>
      <p className="text-sm text-slate-400 my-3">{mode==='password'?'Sign in with your approved administrator account.':'Enter the current code from your authenticator app.'}</p>
      <form onSubmit={submit} className="space-y-4">
        {mode==='password' ? <>
          <label className="block text-sm">Email<input aria-label="Email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required className="block w-full mt-2 rounded-xl bg-slate-950 border border-slate-700 p-3" /></label>
          <label className="block text-sm">Password<input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="block w-full mt-2 rounded-xl bg-slate-950 border border-slate-700 p-3" /></label>
        </> : <>
          {mode==='enroll' && qr && <div><p className="text-sm mb-3">Scan this QR code with your authenticator app, then enter its code to complete setup.</p><img src={qr} alt="MFA enrollment QR" className="w-52 rounded bg-white p-2" /></div>}
          <label className="block text-sm">Authenticator code<input aria-label="Authenticator code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} required className="block w-full mt-2 rounded-xl bg-slate-950 border border-slate-700 p-3" /></label>
        </>}
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <button type="submit" disabled={busy || !client} className="w-full rounded-xl bg-indigo-600 p-3 disabled:opacity-50">{busy?'Verifying…':mode==='password'?'Continue':'Verify & sign in'}</button>
        {mode!=='password' && <button type="button" disabled={busy} onClick={()=>{void reset().catch(()=>setError('Unable to restart sign-in. Reload this page.'));}} className="w-full text-sm text-slate-300">Start again</button>}
      </form>
      {!client && <p role="status" className="text-sm text-amber-300 mt-4">Administrator sign-in is not configured. Contact the system owner.</p>}
      <button disabled={busy} className="text-sm text-slate-400 mt-5" onClick={()=>{props.setShowAdminPanel(false);window.history.pushState({},'','/');}}>Return to website</button>
    </div>
  </main>;
}
