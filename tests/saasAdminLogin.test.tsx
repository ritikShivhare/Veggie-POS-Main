// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({signInWithPassword:vi.fn(),signOut:vi.fn(),getSession:vi.fn(),mfa:{listFactors:vi.fn(),enroll:vi.fn(),challengeAndVerify:vi.fn(),unenroll:vi.fn()}}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth})}));
import SaasAdminLogin from '../src/features/saas/SaasAdminLogin';
import {ApiClient} from '../src/features/shared/services/api';
let root:Root,host:HTMLDivElement,props:any;
beforeEach(()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  vi.clearAllMocks();vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('VITE_SUPABASE_ANON_KEY','public-test-key');
  auth.signInWithPassword.mockResolvedValue({data:{user:{app_metadata:{role:'SUPER_ADMIN'}}},error:null});
  auth.signOut.mockResolvedValue({error:null});auth.mfa.unenroll.mockResolvedValue({error:null});
  auth.mfa.listFactors.mockResolvedValue({data:{totp:[{id:'verified-factor',status:'verified'}]},error:null});
  auth.mfa.challengeAndVerify.mockResolvedValue({error:null});
  auth.getSession.mockResolvedValue({data:{session:{access_token:'provider-token'}}});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({success:true,user:{id:'supabase:owner',name:'SaaS Owner',role:'SaaS Owner',permissions:['super_admin']},session:{sessionId:'backend-session'}})}));
  ApiClient.setSessionId(null);host=document.createElement('div');document.body.append(host);root=createRoot(host);
  props={currentStaff:null,setCurrentStaff:vi.fn(),setCurrentSessionId:vi.fn(),setActiveTab:vi.fn(),setShowAdminPanel:vi.fn()};
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.unstubAllEnvs();ApiClient.setSessionId(null);});
async function enter(label:string,value:string) {
  const input=host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
}
async function submit(){await act(async()=>{host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
it('requires an authenticator challenge before creating the server session',async()=>{
  await act(async()=>root.render(<SaasAdminLogin {...props}/>));
  await enter('Email','owner@example.test');await enter('Password','test-password');await submit();
  expect(host.textContent).toContain('authenticator');expect(fetch).not.toHaveBeenCalled();expect(props.setCurrentStaff).not.toHaveBeenCalled();
  await enter('Authenticator code','123456');await submit();
  expect(ApiClient.getSessionId()).toBe('backend-session');expect(props.setActiveTab).toHaveBeenCalledWith('saas-admin');
});
it('shows MFA enrollment and keeps the dashboard closed when verification fails',async()=>{
  auth.mfa.listFactors.mockResolvedValue({data:{totp:[]},error:null});
  auth.mfa.enroll.mockResolvedValue({data:{id:'new-factor',totp:{qr_code:'data:image/svg+xml,test'}},error:null});
  auth.mfa.challengeAndVerify.mockResolvedValue({error:new Error('Invalid authenticator code')});
  await act(async()=>root.render(<SaasAdminLogin {...props}/>));await enter('Email','owner@example.test');await enter('Password','test-password');await submit();
  expect(host.querySelector('img[alt="MFA enrollment QR"]')).not.toBeNull();
  await enter('Authenticator code','000000');await submit();
  expect(host.textContent).toContain('Invalid authenticator code');expect(ApiClient.getSessionId()).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
