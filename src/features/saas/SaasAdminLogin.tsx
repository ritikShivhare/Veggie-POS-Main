import React,{useState,useEffect,useRef} from 'react';
import {StaffMember} from '../shared/types';
import {ApiClient} from '../shared/services/api';
interface Props {currentStaff:StaffMember|null;setCurrentStaff:(s:StaffMember|null)=>void;setCurrentSessionId:(s:string|null)=>void;setActiveTab:(s:string)=>void;setShowAdminPanel:(b:boolean)=>void;}
export default function SaasAdminLogin(props:Props) {
  const [password,setPassword]=useState(''),[otp,setOtp]=useState(''),[challenge,setChallenge]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[cooldown,setCooldown]=useState(0);
  const googleButton=useRef<HTMLDivElement>(null);
  const finish=(data:any)=>{if(data.user?.role!=='SaaS Owner' || !data.session?.sessionId) throw new Error('Administrator verification failed.');ApiClient.setSessionId(data.session.sessionId);props.setCurrentSessionId(data.session.sessionId);props.setCurrentStaff(data.user);props.setActiveTab('saas-admin');};
  useEffect(()=>{if(!cooldown) return;const timer=setTimeout(()=>setCooldown(c=>Math.max(0,c-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  useEffect(()=>{
    let active=true;
    (async()=>{
      try {
        const config=await (await fetch('/api/auth/public-config')).json();if(!config.googleClientId || !active) return;
        const sdk=await new Promise<any>((resolve,reject)=>{
          if((window as any).google?.accounts?.id) return resolve((window as any).google);
          const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>resolve((window as any).google);script.onerror=()=>reject(new Error('Google sign-in unavailable.'));document.head.appendChild(script);
        });
        if(!active || !googleButton.current) return;
        sdk.accounts.id.initialize({client_id:config.googleClientId,callback:async(response:any)=>{
          setBusy(true);setError('');try{const result=await (await fetch('/api/saas-admin/google-login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:response.credential})})).json();if(!result.success) throw new Error(result.message || 'Google sign-in failed.');finish(result);}catch(e:any){setError(e.message);}finally{setBusy(false);}
        }});
        sdk.accounts.id.renderButton(googleButton.current,{theme:'outline',size:'large',width:300});
      }catch(e:any){if(active) setError(e.message);}
    })();return()=>{active=false;};
  },[]);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');
    try {
      const data=await (await fetch('/api/saas-admin/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(challenge?{challengeToken:challenge.challengeToken,otp}:{password})})).json();
      if(!data.success) throw new Error(data.message || 'Login failed.');
      if(data.requireOtp || data.require2FA){setChallenge(data);setPassword('');setOtp('');setCooldown(30);}else finish(data);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  const resend=async()=>{
    setBusy(true);setError('');try{const data=await (await fetch('/api/saas-admin/resend-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeToken:challenge.challengeToken})})).json();if(!data.success) throw new Error(data.message || 'Email could not be sent.');setCooldown(30);}catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><div className="w-full max-w-md rounded-3xl bg-slate-900 p-8 border border-slate-700">
    <h1 className="text-xl font-bold">Aatmyam POS administrator</h1>
    <p className="text-sm text-slate-400 my-3">{challenge?`Enter the email code sent to ${challenge.email || 'your configured address'}.`:'Use your configured administrator account.'}</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">{challenge?'Verification code':'Password'}<input className="block w-full mt-2 rounded-xl bg-slate-950 border border-slate-700 p-3" type={challenge?'text':'password'} autoComplete={challenge?'one-time-code':'current-password'} inputMode={challenge?'numeric':undefined} value={challenge?otp:password} onChange={e=>challenge?setOtp(e.target.value.replace(/\D/g,'').slice(0,6)):setPassword(e.target.value)} required /></label>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-indigo-600 p-3 disabled:opacity-50">{busy?'Checking…':challenge?'Verify and login':'Send verification code'}</button>
      {challenge && <button type="button" disabled={busy || cooldown>0} onClick={resend} className="w-full text-sm text-slate-300 disabled:opacity-50">{cooldown?`Resend in ${cooldown}s`:'Resend verification code'}</button>}
    </form>
    <div ref={googleButton} className="mt-5 flex justify-center" />
    <button className="text-sm text-slate-400 mt-5" onClick={()=>{props.setShowAdminPanel(false);window.history.pushState({},'','/');}}>Return to website</button>
  </div></main>;
}
