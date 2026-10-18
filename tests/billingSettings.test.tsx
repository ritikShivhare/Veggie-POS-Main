// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('../src/features/shared/services/api',()=>({ApiClient:{getSessionId:()=> 'backend-session',generateIdempotencyKey:()=> 'checkout-ui-test'}}));
import {BillingSettings} from '../src/features/shared/components/BillingSettings';
let host:HTMLDivElement,root:Root;const network=vi.fn();
const data={success:true,subscription:{plan:'free',cycleStart:'2026-01-01',cycleEnd:'2026-01-31',inventoryFrozen:true,trialUsed:true},usage:{staffCount:0,monthlyOrders:1,openKots:1},limits:{staffCount:3,monthlyOrders:30},links:[{id:'invoice-1',plan:'pro',amount:999,status:'ACTIVE',expiresAt:'2026-12-01'}]};
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;network.mockReset();vi.stubGlobal('fetch',network);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const reply=(body:any,ok=true)=>({ok,json:async()=>body});
it('shows matching Owner-plus-staff limits and checks payment on backend before changing access',async()=>{
 network.mockResolvedValue(reply(data));await act(async()=>root.render(<BillingSettings tenantId="restaurant"/>));
 expect(host.textContent).toContain('Owner + 25 staff');expect(host.textContent).toContain('₹1999 / 30 days');expect(host.textContent).toContain('read-only');
 const check=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Check Payment Status')!;
 network.mockResolvedValueOnce(reply({success:true,link:{status:'PAID'}})).mockResolvedValue(reply({...data,subscription:{...data.subscription,plan:'pro',inventoryFrozen:false}}));
 await act(async()=>check.click());
 expect(network).toHaveBeenCalledWith('/api/billing/check-payment-status',expect.objectContaining({method:'POST',credentials:'include',body:JSON.stringify({linkId:'invoice-1'})}));
 expect(host.textContent).not.toContain('Inventory is read-only');
});
it('shows fetch errors and never invents an active/free subscription on failure',async()=>{
 network.mockResolvedValue(reply({success:false,message:'Database temporarily unavailable'},false));await act(async()=>root.render(<BillingSettings tenantId="restaurant"/>));
 expect(host.querySelector('[role="alert"]')?.textContent).toContain('Database temporarily unavailable');expect(host.textContent).not.toContain('Free Starter');
});
it('hides purchase buttons during Financial Review while retaining status reconciliation',async()=>{
 network.mockResolvedValue(reply({...data,subscription:{...data.subscription,financialReview:true}}));await act(async()=>root.render(<BillingSettings tenantId="restaurant"/>));
 expect(host.textContent).toContain('Financial Review');expect(host.textContent).not.toContain('Pay with Cashfree');expect(host.textContent).toContain('Check Payment Status');
});
