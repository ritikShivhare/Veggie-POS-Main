// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),put:vi.fn(),outbox:vi.fn(),drain:vi.fn()}));
vi.mock('../src/features/shared/services/api',()=>({ApiClient:{authenticatedFetch:mocks.fetch,generateIdempotencyKey:()=>crypto.randomUUID()}}));
vi.mock('../src/features/shared/services/offline',()=>({offlineRepository:{getAllOutbox:mocks.outbox,putOrder:mocks.put},OutboxProcessor:{triggerDrain:mocks.drain}}));
import KitchenKDS from '../src/features/kitchen/KitchenKDS';
import POSBilling from '../src/features/pos/POSBilling';
import {RunningSettlement} from '../src/features/pos/RunningSettlement';
let root:Root,host:HTMLDivElement;
const item={menuItem:{id:'meal',name:'Meal',price:100,category:'Main',isAvailable:true,isVegetarian:true},quantity:2};
const order:any={id:'bill',orderNumber:'2026-11-20/001',date:new Date().toISOString(),type:'Dine-In',tableNo:'T-01',items:[item],subtotal:200,tax:10,total:210,status:'Pending',version:1,cashierId:'owner',cashierName:'Owner',running:{gstRate:5,operations:{},batches:[{id:'kot-1',number:1,items:[item],status:'Pending',createdAt:new Date().toISOString(),createdBy:'owner',version:1}]}};
const settings:any={gstPercentage:5,standardDiscountPercentage:5,maxDiscountPercentage:30};
beforeEach(()=>{vi.clearAllMocks();mocks.outbox.mockResolvedValue([]);mocks.put.mockResolvedValue(undefined);(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open');}});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function change(selector:string,value:string){const el=host.querySelector(selector) as HTMLInputElement;await act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function click(text:string){await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.trim()===text)!.click());}
it('keeps discount and Manager PIN out of initial entry and requires an explicit append/new choice',async()=>{
 const created=vi.fn();await act(async()=>root.render(<POSBilling menuItems={[item.menuItem]} ingredients={[]} recipes={[]} settings={settings} currentStaff={{id:'waiter',name:'Waiter',role:'Waiter',pin:'',permissions:['orders']}} orders={[order]} onOrderCreated={created} onUpdateOrderStatus={vi.fn()} onUpdateIngredients={vi.fn()} customers={[]} setCustomers={vi.fn()}/>));
 expect(host.querySelector('#pos-apply-discount-btn')).toBeNull();expect(host.textContent).not.toContain('Approving Manager');
 await act(async()=>(host.querySelector('#menu-item-card-meal') as HTMLDivElement).click());
 await click('Submit Order (Send to KDS)');expect(created).not.toHaveBeenCalled();expect(host.textContent).toContain('Choose an existing bill');
 await change('#pos-running-bill-select','bill');await click('Add Items & Send to KDS');
 expect(created).toHaveBeenCalledOnce();expect(created.mock.calls[0][0]).toMatchObject({appendToOrderId:'bill',expectedVersion:1,items:[{quantity:1}]});
 expect(created.mock.calls[0][0].managerPin).toBeUndefined();
});
it('shows only an unserved batch in KDS and sends a batch command without touching payment',async()=>{
 const second={...item,menuItem:{...item.menuItem,id:'bread',name:'Bread'}};
 const running={...order,running:{...order.running,batches:[{...order.running.batches[0],status:'Served'},{...order.running.batches[0],id:'kot-2',number:2,items:[second]}]}};
 mocks.fetch.mockResolvedValue({ok:true,json:async()=>({success:true,data:{...running,running:{...running.running,batches:[running.running.batches[0],{...running.running.batches[1],status:'Preparing',version:2}]}}})});
 const legacy=vi.fn();await act(async()=>root.render(<KitchenKDS orders={[running]} onUpdateOrderStatus={legacy} kdsSoundAlerts={false}/>));
 expect(host.textContent).toContain('Bread');expect(host.textContent).not.toContain('2x Meal');await click('Start Preparing');
 expect(mocks.fetch.mock.calls[0][0]).toBe('/api/orders/bill/kot/kot-2/status');expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual({status:'Preparing',version:1});expect(legacy).not.toHaveBeenCalled();
});
it('calculates the final amount at checkout and requests approval only where needed',async()=>{
 await act(async()=>root.render(<RunningSettlement order={order} settings={settings} customers={[]} tenantId="test" onClose={vi.fn()} onPaid={vi.fn()}/>));
 await change('#settlement-discount','5');expect(host.querySelector('#settlement-manager-pin')).toBeNull();expect(host.querySelector('[data-testid=settlement-final]')?.textContent).toBe('₹199.50');
 await change('#settlement-discount','custom');await change('#settlement-custom-discount','10');expect(host.querySelector('#settlement-manager-pin')).not.toBeNull();expect(host.querySelector('[data-testid=settlement-final]')?.textContent).toBe('₹189.00');
});
it('does not open a paid receipt on a failed settlement and clears the in-memory approval PIN',async()=>{
 mocks.fetch.mockResolvedValue({ok:false,json:async()=>({success:false,message:'Manager PIN not accepted'})});const paid=vi.fn();
 await act(async()=>root.render(<RunningSettlement order={order} settings={settings} customers={[]} tenantId="test" onClose={vi.fn()} onPaid={paid}/>));
 await change('#settlement-discount','10');await change('#settlement-reason','Courtesy');await change('#settlement-manager-pin','123456');await change('#settlement-cash','500');
 await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(paid).not.toHaveBeenCalled();expect(mocks.put).not.toHaveBeenCalled();expect(host.textContent).toContain('Manager PIN not accepted');expect((host.querySelector('#settlement-manager-pin') as HTMLInputElement).value).toBe('');
});
