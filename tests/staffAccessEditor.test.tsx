// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const api=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../src/features/shared/services/api',()=>({ApiClient:{authenticatedFetch:api.fetch}}));
import StaffAccessEditor from '../src/features/staff/StaffAccessEditor';
let root:Root,host:HTMLDivElement;const saved=vi.fn(),logout=vi.fn();
const staff={id:'cashier',name:'Cashier',role:'Cashier',version:2,permissions:['billing']} as any;
beforeEach(()=>{vi.clearAllMocks();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
async function render(row=staff){await act(async()=>root.render(<StaffAccessEditor tenantId="test-tenant" staffList={[row]} currentStaffId="owner" onSaved={saved} onDeleted={()=>{}} onOwnChange={logout}/>));}
async function pin(value:string){await act(async()=>{const input=host.querySelector('input[type=password]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function click(label:string){await act(async()=>Array.from(host.querySelectorAll('button')).find(button=>button.textContent===label)!.click());}
const response=(status:number,data:any)=>({status,ok:status<400,json:async()=>data});
it('keeps typed digits local and sends one complete versioned PIN only on Save',async()=>{
 api.fetch.mockResolvedValue(response(200,{success:true,data:{...staff,version:3}}));await render();await pin('12');expect(api.fetch).not.toHaveBeenCalled();await click('Save changes for Cashier');expect(api.fetch).not.toHaveBeenCalled();expect(host.textContent).toContain('complete 4–6 digit');
 await pin('001234');await click('Save changes for Cashier');expect(api.fetch).toHaveBeenCalledTimes(1);
 expect(JSON.parse(api.fetch.mock.calls[0][1].body)).toEqual({version:2,pin:'001234',permissions:['billing']});expect(saved).toHaveBeenCalled();expect(logout).not.toHaveBeenCalled();expect((host.querySelector('input[type=password]') as HTMLInputElement).value).toBe('');
});
it('saves permissions without sending or clearing an existing PIN',async()=>{
 api.fetch.mockResolvedValue(response(200,{success:true,data:{...staff,permissions:['billing','inventory'],version:3}}));await render();await act(async()=>{(host.querySelectorAll('input[type=checkbox]')[1] as HTMLInputElement).click();});expect(api.fetch).not.toHaveBeenCalled();await click('Save changes for Cashier');
 const payload=JSON.parse(api.fetch.mock.calls[0][1].body);expect(payload).not.toHaveProperty('pin');expect(payload.permissions).toEqual(['billing','inventory']);expect(logout).not.toHaveBeenCalled();
});
it('preserves the draft and avoids false success when the API fails',async()=>{
 api.fetch.mockResolvedValue(response(503,{success:false,message:'Unavailable'}));await render();await pin('56438');await click('Save changes for Cashier');expect(saved).not.toHaveBeenCalled();expect(host.textContent).toContain('Unavailable');expect(host.textContent).not.toContain('Staff changes saved.');expect((host.querySelector('input[type=password]') as HTMLInputElement).value).toBe('56438');
});
it('does not auto-retry a conflict and requires explicit load/review',async()=>{
 api.fetch.mockResolvedValueOnce(response(409,{success:false})).mockResolvedValueOnce(response(200,{success:true,data:{...staff,version:5,permissions:['reports']}}));await render();await pin('23567');await click('Save changes for Cashier');expect(api.fetch).toHaveBeenCalledTimes(1);expect(host.textContent).toContain('changed elsewhere');await click('Load latest record');expect(api.fetch).toHaveBeenCalledTimes(2);expect((host.querySelector('input[type=password]') as HTMLInputElement).value).toBe('');expect(host.textContent).toContain('Review and enter your changes again');
});
it('protects Owner permissions and signs out only after an explicit own PIN save',async()=>{
 api.fetch.mockResolvedValue(response(200,{success:true,data:{...staff,id:'owner',name:'Owner',role:'Owner',version:3}}));await render({...staff,id:'owner',name:'Owner',role:'Owner'});expect(Array.from(host.querySelectorAll('input[type=checkbox]')).every(box=>(box as HTMLInputElement).disabled)).toBe(true);await pin('23567');expect(logout).not.toHaveBeenCalled();await click('Save changes for Owner');expect(JSON.parse(api.fetch.mock.calls[0][1].body)).not.toHaveProperty('permissions');expect(logout).toHaveBeenCalledTimes(1);
});
