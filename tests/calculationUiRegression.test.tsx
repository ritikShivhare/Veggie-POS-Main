// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {beforeEach,afterEach,afterAll,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({getSync:vi.fn(),saveSync:vi.fn(),loadLocal:vi.fn(),saveLocal:vi.fn(),getOrders:vi.fn(),getCustomers:vi.fn(async()=>[]),fetch:vi.fn(),recordShift:vi.fn(async(..._args:any[])=>{}),getShifts:vi.fn(async()=>[])}));
vi.mock('../src/features/shared/services/api',()=>({ApiClient:{getTenantSync:mocks.getSync,saveTenantSync:mocks.saveSync,authenticatedFetch:mocks.fetch,generateIdempotencyKey:()=>crypto.randomUUID(),setSessionId:vi.fn()}}));
vi.mock('../src/features/shared/services/offline',()=>({offlineRepository:{getFullTenantState:mocks.loadLocal,saveFullTenantState:mocks.saveLocal,getOrders:mocks.getOrders,getCustomers:mocks.getCustomers,resumeAuthOperations:vi.fn(async()=>{}),getAllOutbox:vi.fn(async()=>[]),getShifts:mocks.getShifts,recordShiftOffline:mocks.recordShift},OutboxProcessor:{triggerDrain:vi.fn(async()=>{})}}));
import {useAuthSession} from '../src/features/shared/hooks/useAuthSession';
import {useSyncState} from '../src/features/shared/hooks/useSyncState';
import Dashboard from '../src/features/shared/components/Dashboard';
import AIReportsView from '../src/features/shared/components/AIReportsView';
import POSBilling from '../src/features/pos/POSBilling';
import KitchenKDS from '../src/features/kitchen/KitchenKDS';
import NotificationRoutingSettings from '../src/features/shared/components/NotificationRoutingSettings';
import {defaultNotificationRules} from '../src/features/shared/notificationRules';
import InventoryManagement from '../src/features/inventory/InventoryManagement';

let root:Root,host:HTMLDivElement,latest:ReturnType<typeof useSyncState>;
const owner={id:'owner',name:'Synthetic Owner',role:'Owner'} as any;
function Harness(){latest=useSyncState({activeTenantId:'synthetic-ui-calculation',currentStaff:owner,currentSessionId:'synthetic'});return null;}
const settings={gstPercentage:5,autoDeductStock:false,blockOrdersIfInsufficient:false};
function bill(id:string,total:number,status='Completed',daysAgo=0,price=100,qty=1):any{
 const date=new Date();date.setDate(date.getDate()-daysAgo);return {id,orderNumber:'2026-11-20/001',date:date.toISOString(),paidAt:status==='Completed'?date.toISOString():undefined,status,total,subtotal:price*qty,tax:total-price*qty,discount:0,paymentMethod:status==='Completed'?'Cash':undefined,type:'Dine-In',items:[{menuItem:{id:id+'-menu',name:id,price,category:'Audit',isAvailable:true},quantity:qty}]};
}
async function loadHook(orders:any[]){
 const data={menuItems:[{id:'tea',name:'Tea',price:100,isAvailable:true}],ingredients:[],recipes:[],staffList:[owner],orders,customers:[],purchases:[],shifts:[],settings};
 mocks.getSync.mockResolvedValue({success:true,initialized:true,data});mocks.getOrders.mockResolvedValue(orders);mocks.saveSync.mockResolvedValue({success:true,data});
 await act(async()=>root.render(<Harness/>));expect(latest.isTenantDataReady).toBe(true);
 return latest.dashboardStats;
}
async function click(label:string){await act(async()=>{const b=[...host.querySelectorAll('button')].find(e=>e.textContent?.trim()===label);expect(b).toBeTruthy();b!.click();});}
async function dashboard(orders:any[],stats:any){await act(async()=>root.render(<Dashboard dashboardStats={stats} orders={orders} ingredients={[]} shifts={[]} setActiveTab={()=>{}} handleGenerateAIReport={()=>{}}/>));}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));vi.clearAllMocks();localStorage.clear();vi.stubGlobal('WebSocket',undefined);(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;mocks.loadLocal.mockResolvedValue({menuItems:[]});mocks.saveLocal.mockResolvedValue(undefined);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

it('includes overnight settlements and carried open bills in today summaries',async()=>{
 const overnight={...bill('overnight',105,'Completed',1),paidAt:new Date().toISOString()};const oldPending=bill('old-open',210,'Pending',1);
 const stats=await loadHook([overnight,oldPending]);expect(stats.totalRevenue).toBe(105);
 await dashboard([overnight,oldPending],stats);expect(host.querySelector('[data-testid=dashboard-paid-checkouts]')?.textContent).toBe('1');expect(host.querySelector('[data-testid=dashboard-pending-orders]')?.textContent).toBe('1');

});
it('uses paid-checkout cohorts and the same day for report averages and top dishes',async()=>{
 const orders=[bill('today-paid',105),bill('pending',210,'Pending'),bill('cancelled',315,'Cancelled'),bill('historical-bestseller',10500,'Completed',20,100,100)];
 const stats=await loadHook(orders);expect(stats.totalRevenue).toBe(105);expect(stats.totalOrders).toBe(3);expect(stats.topSellingItems[0].name).toBe('today-paid');
 await act(async()=>root.render(<AIReportsView dashboardStats={stats} handleGenerateAIReport={async()=>{}} isGeneratingReport={false} reportError="" aiReport=""/>));expect(host.textContent).toContain('₹105');


});
it('separates GST from net sales and preserves the paise in average bills',async()=>{
 const orders=[bill('a',100),bill('b',101)];const stats=await loadHook(orders);await dashboard(orders,stats);expect(host.textContent).toContain('Avg paid bill ₹100.50');await click('Time-Range Insights');
 const summary=host.querySelector('[aria-label="Selected period summary"]')!;expect(summary.querySelector('[aria-label="Average Paid Bill"]')?.textContent).toContain('₹100.50');

 const taxable=bill('gst',105);await dashboard([taxable],{...stats,totalRevenue:105,cashRevenue:105,totalOrders:1});
 expect(host.querySelector('[aria-label="Selected period summary"] [aria-label="Net Sales"]')?.textContent).toContain('₹100.00');
});
it('shows a negative estimated profit including its sign',async()=>{
 const loss={...bill('loss',10.5),subtotal:100,tax:0.5,discount:90};const stats=await loadHook([loss]);await dashboard([loss],stats);await click('Time-Range Insights');
 expect(host.querySelector('[aria-label="Estimated Profit"]')?.textContent).toContain('-₹25.00');
});
it('uses the saved GST snapshot for the add-on estimate',async()=>{
 const meal={id:'meal',name:'Meal',price:100,category:'Audit',isAvailable:true};const existing={...bill('open',105,'Pending'),tableNo:'T-01',version:1,items:[{menuItem:meal,quantity:1}],running:{billVersion:1,gstRate:5,batches:[],operations:{}}};
 await act(async()=>root.render(<POSBilling menuItems={[meal] as any} ingredients={[]} recipes={[]} settings={{...settings,gstPercentage:12} as any} currentStaff={{...owner,pin:'',permissions:['orders']} as any} orders={[existing]} onOrderCreated={()=>{}} onUpdateOrderStatus={()=>{}} onUpdateIngredients={()=>{}} customers={[]} setCustomers={()=>{}}/>));
 await act(async()=>(host.querySelector('#menu-item-card-meal') as HTMLElement).click());const select=host.querySelector('#pos-running-bill-select') as HTMLSelectElement;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(select,'open');select.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(host.textContent).toContain('Combined estimate: ₹210.00');
});
it('collects a cashier opening float before starting the shift',async()=>{
 let auth:any;const cashier={id:'cashier',name:'Synthetic cashier',role:'Cashier',permissions:['billing']} as any;
 function AuthHarness(){auth=useAuthSession({activeTenantId:'synthetic-ui-calculation',shifts:[],setShifts:()=>{},staffList:[],currentStaff:cashier,setCurrentStaff:()=>{},currentSessionId:null,setCurrentSessionId:()=>{}});return null;}
 vi.spyOn(window,'prompt').mockReturnValue('500');await act(async()=>root.render(<AuthHarness/>));await act(async()=>auth.handleShiftAction());
 expect(mocks.recordShift).toHaveBeenCalledOnce();expect(mocks.recordShift.mock.calls[0][1]).toHaveProperty('openingCash',500);
});
it('prints paise in line amounts and does not infer a false historical GST rate',async()=>{
 const paid={...bill('decimal-receipt',11.03,'Completed',0,10.5),subtotal:10.5,tax:0.53,items:[{menuItem:{id:'decimal-tea',name:'Decimal Tea',price:10.5,category:'Audit',isAvailable:true},quantity:1}]};
 await act(async()=>root.render(<POSBilling menuItems={[]} ingredients={[]} recipes={[]} settings={settings as any} currentStaff={{...owner,pin:'',permissions:['billing']} as any} orders={[paid]} onOrderCreated={()=>{}} onUpdateOrderStatus={()=>{}} onUpdateIngredients={()=>{}} customers={[]} setCustomers={()=>{}}/>));
 const tap=async(selector:string)=>act(async()=>{(host.querySelector(selector) as HTMLElement).click();});
 await tap('#pos-subtab-billing');await tap('#pos-bills-filter-settled');await tap('#pos-print-receipt-btn-decimal-receipt');
 const receipt=host.querySelector('#pos-receipt-print-body')!;const name=[...receipt.querySelectorAll('span')].find(s=>s.textContent==='Decimal Tea')!;const fields=[...name.parentElement!.querySelectorAll('span')].map(s=>s.textContent);
 expect(fields).toEqual(['Decimal Tea','1','10.50','10.50']);expect(receipt.textContent).toContain('SubtotalINR 10.50');
 expect(receipt.textContent).not.toContain('GST (5.05%)');
 expect(receipt.textContent?.toLowerCase()).not.toContain('pure vegetarian');

});

const stock={id:'flour',name:'Flour',unit:'kg',currentStock:10,minStock:0,costPerUnit:100,version:1};
const dish={id:'meal',name:'Meal',price:100,category:'Main',isAvailable:true};
async function inventory(extra:any={}){
 const callbacks={onUpdateIngredients:vi.fn(),onUpdateRecipes:vi.fn(),onUpdateMenuItems:vi.fn(),onAddPurchase:vi.fn()};
 await act(async()=>root.render(<InventoryManagement ingredients={[stock]} menuItems={[dish] as any} recipes={[]} purchases={[]} settings={settings as any} currentStaff={owner} {...callbacks} {...extra}/>));return callbacks;
}
async function input(selector:string,value:string){const el=host.querySelector(selector) as HTMLInputElement;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});}
async function tap(selector:string){await act(async()=>(host.querySelector(selector) as HTMLElement).click());}
it('submits one purchase command without also writing an inventory snapshot',async()=>{
 const callbacks=await inventory();await click('Vendor Purchases');await tap('#add-purchase-btn');await input('input[placeholder="e.g. 10"]','10');await input('input[placeholder="e.g. 20"]','200');await tap('#save-purchase-submit-btn');
 expect(callbacks.onAddPurchase).toHaveBeenCalledOnce();expect(callbacks.onAddPurchase.mock.calls[0][0]).toMatchObject({quantity:10,cost:2000});expect(callbacks.onUpdateIngredients).not.toHaveBeenCalled();
});
it('preserves an edited recipe version and the quantity of a legacy unitless recipe',async()=>{
 const callbacks=await inventory({recipes:[{menuItemId:'meal',version:7,ingredients:[{ingredientId:'flour',quantity:0.2}]}]});await click('Recipes Mapping');await tap('#map-recipe-btn-meal');await tap('#save-recipe-submit-btn');
 expect(callbacks.onUpdateRecipes.mock.calls[0][0]).toEqual([{menuItemId:'meal',version:7,ingredients:[{ingredientId:'flour',quantity:0.2,unit:'kg'}]}]);
});
it('locks storage units and shows untracked consumption with enough cost precision',async()=>{
 await inventory({ingredients:[{...stock,costPerUnit:0.035,untrackedConsumption:0.1}]});expect(host.textContent).toContain('INR 0.035');expect(host.textContent).toContain('Untracked consumption: 0.1 kg');await tap('#edit-ing-btn-flour');
 const unit=[...host.querySelectorAll('select')].find(s=>s.value==='kg');expect(unit?.disabled).toBe(true);
});
it('lets the Manager choose recovered stock and shows the remaining wastage',async()=>{
 const pending={...bill('cancel-choice',105,'Preparing'),tableNo:'T-01',version:2};
 mocks.fetch.mockResolvedValue({ok:true,json:async()=>({success:true,data:{version:2,prepared:true,ingredients:[{ingredientId:'flour',name:'Flour',unit:'kg',issued:1,costBasisKnown:true}]}})});
 await act(async()=>root.render(<POSBilling menuItems={[]} ingredients={[]} recipes={[]} settings={settings as any} currentStaff={{...owner,pin:'',permissions:['billing']} as any} orders={[pending]} onOrderCreated={()=>{}} onUpdateOrderStatus={()=>{}} onUpdateIngredients={()=>{}} customers={[]} setCustomers={()=>{}}/>));
 await tap('#pos-subtab-billing');await tap('#pos-cancel-btn-cancel-choice');expect((host.querySelector('[aria-label="Recovered Flour"]') as HTMLInputElement).value).toBe('0');await input('[aria-label="Recovered Flour"]','0.25');expect(host.textContent).toContain('Wastage: 0.75 kg');expect((host.querySelector('#pos-confirm-cancel-btn') as HTMLButtonElement).disabled).toBe(false);
});
it('does not show the KDS Test Sound control',async()=>{
 await act(async()=>root.render(<KitchenKDS orders={[]} onUpdateOrderStatus={()=>{}} kdsSoundAlerts={true}/>));expect(host.querySelector('#kds-test-sound-btn')).toBeNull();expect(host.textContent).not.toContain('Test Sound');
});
it('shows only today settlements in Settled and All while retaining older unpaid bills',async()=>{
 const today=bill('today-paid',105),yesterday=bill('yesterday-paid',105,'Completed',1),overnight={...bill('overnight-paid',105,'Completed',1),paidAt:new Date().toISOString()},open=bill('old-open',105,'Pending',2);
 await act(async()=>root.render(<POSBilling menuItems={[]} ingredients={[]} recipes={[]} settings={settings as any} currentStaff={{...owner,pin:'',permissions:['billing']} as any} orders={[today,yesterday,overnight,open]} onOrderCreated={()=>{}} onUpdateOrderStatus={()=>{}} onUpdateIngredients={()=>{}} customers={[]} setCustomers={()=>{}}/>));
 await tap('#pos-subtab-billing');await tap('#pos-bills-filter-settled');expect(host.querySelector('#pos-print-receipt-btn-today-paid')).not.toBeNull();expect(host.querySelector('#pos-print-receipt-btn-overnight-paid')).not.toBeNull();expect(host.querySelector('#pos-print-receipt-btn-yesterday-paid')).toBeNull();
 await tap('#pos-bills-filter-all');expect(host.querySelector('#pos-print-receipt-btn-yesterday-paid')).toBeNull();expect(host.querySelector('[id="billing-order-card-old-open"]')).not.toBeNull();
});
it('exposes the low-stock off switch under notification settings with its four-hour cadence',async()=>{
 mocks.fetch.mockResolvedValue({ok:true,json:async()=>({success:true,data:structuredClone(defaultNotificationRules)})});await act(async()=>root.render(<NotificationRoutingSettings/>));
 const toggle=host.querySelector('[aria-label="Low stock → Reorder enabled"]') as HTMLInputElement;expect(toggle.checked).toBe(true);await act(async()=>toggle.click());await click('Save notification routing');
 expect(JSON.parse(mocks.fetch.mock.calls.at(-1)![1].body).lowStock.enabled).toBe(false);expect(host.textContent).toContain('4 hours');
});
