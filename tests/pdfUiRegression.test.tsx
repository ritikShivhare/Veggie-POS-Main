// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({role:'Owner', fetch:vi.fn(), record:vi.fn(), drain:vi.fn()}));
vi.mock('../src/features/shared/context/AppContext', () => ({useAppContext: () => ({currentStaff:{role:mocks.role},activeTenant:{tenantId:'ui-test'}})}));
vi.mock('../src/features/shared/services/api', () => ({ApiClient:{authenticatedFetch:mocks.fetch,generateIdempotencyKey:()=>'test-key'}}));
vi.mock('../src/features/shared/services/offline', () => ({offlineRepository:{recordCustomerOffline:mocks.record},OutboxProcessor:{triggerDrain:mocks.drain}}));
import AIReportsView from '../src/features/shared/components/AIReportsView';
import CRMLoyalty from '../src/features/crm/CRMLoyalty';
let host:HTMLDivElement, root:Root;
const guest={id:'guest-1',name:'Guest',phone:'9876543210',loyaltyPoints:4,totalVisits:1,totalSpend:100,maxBillAmount:100,minBillAmount:100,comingSince:'2026-11-01',lastVisited:'2026-11-14'};
beforeEach(() => { vi.clearAllMocks(); mocks.role='Owner'; (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true; host=document.createElement('div'); document.body.append(host); root=createRoot(host); });
afterEach(async () => { await act(async () => root.unmount());host.remove(); });
async function click(text:string) { await act(async () => { Array.from(host.querySelectorAll('button')).find(button=>button.textContent?.includes(text))!.click(); }); }
it('switches report UI to English without Hindi labels or automatic AI requests', async () => {
 const generate=vi.fn();await act(async()=>root.render(<AIReportsView handleGenerateAIReport={generate} isGeneratingReport={false} aiReport="" reportError=""/>));
 await click('अंग्रेज़ी');expect(host.textContent).not.toMatch(/[\u0900-\u097f]/);expect(generate).not.toHaveBeenCalled();
 await click('Run AI Diagnosis');expect(generate).toHaveBeenCalledWith('english');
});
it('uses Hindi labels throughout the report cards and does not mix a prior English document', async () => {
 await act(async()=>root.render(<AIReportsView handleGenerateAIReport={vi.fn()} isGeneratingReport={false} aiReport="English report from a prior selection" reportError=""/>));
 expect(host.textContent).not.toMatch(/Orders|Active Staff|Cards|Full Doc|Cash|Stock|Margin|AI Business/);
 await click('पूरा दस्तावेज़');expect(host.textContent).not.toContain('English report from a prior selection');
});
it.each(['Cashier','Waiter','Cook'])('hides manual points controls and starting balance for %s',async role=>{
 mocks.role=role;await act(async()=>root.render(<CRMLoyalty customers={[guest]} setCustomers={vi.fn()}/>));
 expect(host.textContent).not.toContain('Loyalty Ledger Actions');expect(host.querySelector('#crm-points-adjustment-input')).toBeNull();
 await click('Add New Guest');expect(host.querySelector('#crm-modal-loyalty')).toBeNull();expect(host.querySelector('#crm-modal-gstin')).toBeNull();
});
it.each(['Owner','Manager'])('keeps manual points actions available for %s',async role=>{
 mocks.role=role;await act(async()=>root.render(<CRMLoyalty customers={[guest]} setCustomers={vi.fn()}/>));
 expect(host.querySelector('#crm-points-adjustment-input')).not.toBeNull();
});
it('shows a durable new guest before cloud sync finishes and initializes zero visits',async()=>{
 mocks.record.mockResolvedValue({id:'queued'});mocks.drain.mockImplementation(()=>new Promise(()=>{}));const save=vi.fn();
 await act(async()=>root.render(<CRMLoyalty customers={[]} setCustomers={save}/>));await click('Add New Guest');
 for(const [id,value] of [['crm-modal-name','New guest'],['crm-modal-phone','9876543210']]) {
  const input=host.querySelector('#'+id) as HTMLInputElement;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
 }
 await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(save).toHaveBeenCalled();expect(mocks.record.mock.calls[0][1]).toMatchObject({totalVisits:0,loyaltyPoints:0,lastVisited:''});
 expect(host.textContent).toContain('Cloud sync is pending');expect(host.querySelector('#crm-modal-name')).toBeNull();
});
it('opens actual visit details, including date, bill items and recorded loyalty',async()=>{
 mocks.fetch.mockResolvedValue({ok:true,json:async()=>({success:true,data:[{id:'order',orderNumber:'2026-11-14/001',date:'2026-11-14T10:00:00Z',paidAt:'2026-11-14T10:00:00Z',items:[{menuItem:{name:'Paneer',price:100},quantity:1}],subtotal:100,tax:5,total:100,discount:5,earnedPoints:1,redeemedPoints:5,paymentMethod:'Cash'}]})});
 await act(async()=>root.render(<CRMLoyalty customers={[guest]} setCustomers={vi.fn()}/>));
 await act(async()=>(host.querySelector('#crm-total-visits') as HTMLButtonElement).click());
 expect(mocks.fetch).toHaveBeenCalledWith('/api/customers/guest-1/history');
 const dialog=host.querySelector('[role=dialog]')!;expect(dialog.textContent).toContain('Bill #001');expect(dialog.textContent).toContain('Paneer');expect(dialog.textContent).toContain('Points earned: 1 · Points used: 5');
});
