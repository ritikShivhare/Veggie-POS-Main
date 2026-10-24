// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../src/features/shared/services/api',()=>({ApiClient:{authenticatedFetch:mock.fetch}}));
vi.mock('../src/features/staff/components/StaffQrModal',()=>({default:()=>null}));
import StaffShifts from '../src/features/staff/StaffShifts';
let root:Root,host:HTMLDivElement,update:ReturnType<typeof vi.fn<(staff:any[])=>void>>;
const owner={id:'owner',name:'Owner',role:'Owner',status:'active',permissions:[],pin:''} as any;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();host=document.createElement('div');document.body.append(host);root=createRoot(host);update=vi.fn();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(rows:any[]=[owner]){await act(async()=>root.render(<StaffShifts shifts={[]} activeShift={null} onShiftAction={()=>{}} currentStaff={owner} staffList={rows} onUpdateStaffList={update}/>));}
async function fill(selector:string,value:string){await act(async()=>{const input=host.querySelector(selector) as HTMLInputElement;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function submit(){await fill('input[placeholder="e.g. Vikram Singh"]','Synthetic Employee');await fill('input[type="password"]','82516');await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
const response=(success:boolean,status=200,data:any={})=>({ok:status<400,json:async()=>({success,...data})});
it('allows registering with one active and two inactive records',async()=>{
 mock.fetch.mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(true,200,{data:[owner]}));
 await render([owner,{...owner,id:'old-a',status:'inactive'},{...owner,id:'old-b',status:'inactive'}]);await submit();
 expect(mock.fetch).toHaveBeenCalledWith('/api/staff',expect.objectContaining({method:'POST'}));expect(host.textContent).toContain('Registered Synthetic Employee.');
});
it('does not publish success or mutate the list when creation is rejected',async()=>{
 mock.fetch.mockResolvedValue(response(false,403,{message:'Active limit reached'}));await render();await submit();
 expect(update).not.toHaveBeenCalled();expect(host.textContent).toContain('Active limit reached');expect(host.textContent).not.toContain('Registered Synthetic Employee.');
});
it('reports committed creation plus failed refresh without pretending the list synchronized',async()=>{
 mock.fetch.mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(false,503));await render();await submit();
 expect(update).not.toHaveBeenCalled();expect(host.textContent).toContain('Staff was created, but the staff list could not refresh');expect(host.textContent).not.toContain('Registered Synthetic Employee.');
});
it('retains the confirmation/list when deletion succeeds but refresh fails',async()=>{
 mock.fetch.mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(false,503));await render([owner,{...owner,id:'cashier',name:'Cashier',role:'Cashier'}]);
 await act(async()=>{(host.querySelector('button[title="Delete Staff Member"]') as HTMLButtonElement)?.click();});
 // Select the confirmation by its visible label, independent of icon markup.
 if(!Array.from(host.querySelectorAll('button')).some(b=>b.textContent==='Delete')){
  const iconButton=Array.from(host.querySelectorAll('button')).find(b=>b.querySelector('.lucide-user-minus'))!;await act(async()=>iconButton.click());
 }
 const confirm=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Delete')!;await act(async()=>confirm.click());
 expect(update).not.toHaveBeenCalled();expect(host.textContent).toContain('Staff was deactivated, but the staff list could not refresh');expect(host.textContent).toContain('Cashier');
});
