// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import Dashboard from '../src/features/shared/components/Dashboard';

let host:HTMLDivElement, root:Root;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true; host=document.createElement('div'); document.body.append(host); root=createRoot(host); });
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const order=(status:string,total:number,paid=false):any=>({id:status+total,orderNumber:'2026-11-18/001',date:new Date().toISOString(),status,total,paidAt:paid?new Date().toISOString():undefined,items:[],paymentMethod:'Cash',type:'Dine-In'});
async function render(orders:any[],revenue=0) {
 const navigate=vi.fn(),generate=vi.fn();
 await act(async()=>root.render(<Dashboard orders={orders} ingredients={[]} shifts={[]} setActiveTab={navigate} handleGenerateAIReport={generate}
   dashboardStats={{totalRevenue:revenue,cashRevenue:revenue,upiRevenue:0,totalOrders:orders.length,activeShiftsCount:0,lowStockItems:[],totalStockValue:0,topSellingItems:[]}}/>));
 return {navigate,generate};
}
async function click(label:string){await act(async()=>{Array.from(host.querySelectorAll('button')).find(e=>e.textContent?.trim()===label)!.click();});}
it('shows one unpaid order as pending and zero paid sales/checkouts',async()=>{
 await render([order('Pending',750)]);
 expect(host.querySelector('[data-testid=dashboard-net-sales]')?.textContent).toBe('₹0.00');
 expect(host.querySelector('[data-testid=dashboard-paid-checkouts]')?.textContent).toBe('0');
 expect(host.querySelector('[data-testid=dashboard-pending-orders]')?.textContent).toBe('1');
 expect(host.textContent).toContain('No paid sales yet');
 expect(host.textContent).not.toContain('+100% Real');
 expect(host.textContent).toContain('No ingredients yet');
});
it('separates paid, pending and cancelled orders and bases average on paid bills',async()=>{
 await render([order('Completed',200,true),order('Pending',1000),order('Cancelled',999)],200);
 expect(host.querySelector('[data-testid=dashboard-paid-checkouts]')?.textContent).toBe('1');
 expect(host.querySelector('[data-testid=dashboard-pending-orders]')?.textContent).toBe('1');
 expect(host.textContent).toContain('Avg paid bill ₹200.00');
 expect(host.textContent).toContain('Orders today3');
});
it('does not include unpaid or cancelled orders in period sales',async()=>{
 await render([order('Completed',200,true),order('Pending',1000),order('Cancelled',999)],200);
 await click('Time-Range Insights');
 const summary=host.querySelector('[aria-label="Selected period summary"]')!;
 expect(summary.querySelector('[aria-label="Net Sales"]')?.textContent).toContain('₹200.00');
 expect(summary.querySelector('[aria-label="Paid Checkouts"]')?.textContent).toContain('1');
 expect(summary.textContent).not.toContain('1,200');
 expect(summary.textContent).toContain('No comparison data');
 expect(summary.textContent).not.toContain('+100%');
});
it('shows truthful empty comparison states and keeps English analytics labels',async()=>{
 await render([]); await click('Time-Range Insights');
 const summary=host.querySelector('[aria-label="Selected period summary"]')!;
 expect(summary.textContent).not.toMatch(/65%|100%|[\u0900-\u097f]/);
 expect(summary.textContent?.match(/No comparison data/g)).toHaveLength(4);
 expect(host.textContent).toContain('No paid checkouts in the selected period');
});
it('quick actions navigate without generating an AI report or changing business data',async()=>{
 const {navigate,generate}=await render([]);
 await click('Reports');expect(navigate).toHaveBeenCalledWith('ai-reports');expect(generate).not.toHaveBeenCalled();
 await click('New bill');expect(navigate).toHaveBeenLastCalledWith('billing');
});
