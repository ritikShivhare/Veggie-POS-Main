// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Dashboard from '../src/features/shared/components/Dashboard';
import type {Order} from '../src/features/shared/types';

let root:Root,host:HTMLDivElement;
const row=(id:string,ticket:string,date:string)=>({id,orderNumber:ticket,date,type:'Dine-In',tableNo:'T-01',items:[],status:'Pending',subtotal:100,tax:5,discount:0,total:105} as Order);
const orders=[row('yesterday-001','2026-11-20/001','2026-11-20T10:00:00Z'),row('today-002','2026-11-21/002','2026-11-21T05:30:00Z'),row('today-001','2026-11-21/001','2026-11-20T19:00:00Z'),row('today-010','2026-11-21/010','2026-11-21T06:00:00Z')];
const stats={totalRevenue:0,cashRevenue:0,upiRevenue:0,totalOrders:4,activeShiftsCount:0,lowStockItems:[],totalStockValue:0,topSellingItems:[]};
async function render(rows=orders){await act(async()=>root.render(<Dashboard orders={rows} ingredients={[]} shifts={[]} dashboardStats={stats} setActiveTab={()=>{}} handleGenerateAIReport={()=>{}}/>));}
const ids=()=>[...host.querySelectorAll('[aria-label="Order stream table"] [data-order-id]')].map(e=>e.getAttribute('data-order-id'));
async function click(label:string){await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===label)!.click());}
async function input(label:string,value:string){await act(async()=>{const el=host.querySelector(`[aria-label="${label}"]`)!;const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-21T06:30:00Z'));(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();});

it('defaults to today in India, sorts newest first and identifies the repeated daily ticket by date and time',async()=>{
 await render();expect(ids()).toEqual(['today-010','today-002','today-001']);
 expect((host.querySelector('[aria-label="Order stream date"]') as HTMLInputElement).value).toBe('2026-11-21');
 const midnight=host.querySelector('[data-order-id="today-001"]')!;expect(midnight.textContent).toContain('#001');expect(midnight.textContent).toContain('21 Nov 2026');expect(midnight.textContent).toContain('12:30 am IST');
 await click('All dates');expect(ids()).toEqual(['today-010','today-002','today-001','yesterday-001']);expect(host.querySelector('[data-order-id="yesterday-001"]')?.textContent).toContain('20 Nov 2026');
});
it('combines date and exact numeric ticket search without confusing ticket 001 with 010',async()=>{
 await render();await click('All dates');await input('Search order ticket','#001');expect(ids()).toEqual(['today-001','yesterday-001']);
 await input('Order stream date','2026-11-20');expect(ids()).toEqual(['yesterday-001']);
 await click('Today');expect(ids()).toEqual(['today-001']);await input('Search order ticket','1');expect(ids()).toEqual(['today-001']);
 await input('Search order ticket','999');expect(ids()).toEqual([]);expect(host.textContent).toContain('No orders match this date and ticket.');
});
it('sorts numeric tickets within each day and keeps yesterday separate without mutating input orders',async()=>{
 const original=orders.map(o=>o.id);await render();await click('All dates');await input('Sort order stream','ticket-asc');expect(ids()).toEqual(['today-001','today-002','today-010','yesterday-001']);
 await input('Sort order stream','ticket-desc');expect(ids()).toEqual(['today-010','today-002','today-001','yesterday-001']);
 await input('Sort order stream','oldest');expect(ids()).toEqual(['yesterday-001','today-001','today-002','today-010']);expect(orders.map(o=>o.id)).toEqual(original);
});
it('uses placement date rather than settlement date and retains the existing pending summary',async()=>{
 const overnight={...orders[0],status:'Completed',paidAt:'2026-11-21T05:00:00Z',paymentMethod:'Cash'} as Order;
 await render([overnight,orders[2]]);expect(ids()).toEqual(['today-001']);expect(host.querySelector('[data-testid="dashboard-paid-checkouts"]')?.textContent).toBe('1');expect(host.querySelector('[data-testid="dashboard-pending-orders"]')?.textContent).toBe('1');
 await input('Order stream date','2026-11-20');expect(ids()).toEqual(['yesterday-001']);
});
it('updates Today when the India day changes on a live refresh',async()=>{
 vi.setSystemTime(new Date('2026-11-20T18:29:00Z'));await render();expect(ids()).toEqual(['yesterday-001']);
 vi.setSystemTime(new Date('2026-11-20T18:31:00Z'));await render([...orders]);expect(ids()).toEqual(['today-010','today-002','today-001']);
});
