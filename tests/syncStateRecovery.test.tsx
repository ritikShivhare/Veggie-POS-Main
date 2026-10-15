// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const mocks=vi.hoisted(()=>({getSync:vi.fn(),saveSync:vi.fn(),loadLocal:vi.fn(),saveLocal:vi.fn(),getOrders:vi.fn()}));
vi.mock('../src/features/shared/services/api',()=>({ApiClient:{getTenantSync:mocks.getSync,saveTenantSync:mocks.saveSync}}));
vi.mock('../src/features/shared/services/offline',()=>({
  offlineRepository:{getFullTenantState:mocks.loadLocal,saveFullTenantState:mocks.saveLocal,getOrders:mocks.getOrders,resumeAuthOperations:vi.fn(async()=>{})},
  OutboxProcessor:{triggerDrain:vi.fn(async()=>{})}
}));
import {useSyncState} from '../src/features/shared/hooks/useSyncState';

const owner={id:'test-owner',name:'Test owner',role:'Owner'} as any;
const snapshot=(name:string)=>({success:true,initialized:true,data:{menuItems:[{id:name,name,price:10}],ingredients:[],recipes:[],staffList:[owner],orders:[],customers:[],purchases:[],shifts:[],settings:{gstPercentage:5}}});
let latest:ReturnType<typeof useSyncState>,root:Root;
function Harness({tenant}:{tenant:string}){latest=useSyncState({activeTenantId:tenant,currentStaff:owner,currentSessionId:'synthetic-session'});return null;}
async function render(tenant='restaurant-a'){await act(async()=>{root.render(<Harness tenant={tenant}/>);});}
async function advance(ms:number){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});}

beforeEach(()=>{
  vi.useFakeTimers();vi.clearAllMocks();localStorage.clear();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  vi.stubGlobal('WebSocket',undefined);
  mocks.loadLocal.mockResolvedValue({menuItems:[]});mocks.saveLocal.mockResolvedValue(undefined);mocks.getOrders.mockResolvedValue([]);
  mocks.saveSync.mockImplementation(async(_tenant,payload)=>({success:true,data:{...snapshot('existing').data,...payload}}));
  root=createRoot(document.createElement('div'));
});
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.unstubAllGlobals();});

describe('tenant synchronization recovery',()=>{
  it('accepts a slow initial response and enables durable management saves',async()=>{
    mocks.getSync.mockImplementation(()=>new Promise(resolve=>setTimeout(()=>resolve(snapshot('slow-menu')),5000)));
    await render();await advance(3500);
    expect(latest.isTenantDataReady).toBe(false);
    await advance(1500);
    expect(latest.isTenantDataReady).toBe(true);
    expect(latest.menuItems.map(x=>x.name)).toEqual(['slow-menu']);
    await act(async()=>latest.setMenuItems([...latest.menuItems,{id:'new-dish',name:'New dish',price:20} as any]));
    await advance(500);
    expect(mocks.saveSync).toHaveBeenCalledWith('restaurant-a',expect.objectContaining({menuItems:[expect.objectContaining({id:'new-dish'})]}),'synthetic-session');
  });
  it('never sends staff PIN or permission drafts through the automatic sync path',async()=>{
    mocks.getSync.mockResolvedValue(snapshot('loaded'));
    await render();mocks.saveSync.mockClear();
    await act(async()=>latest.setStaffList([{...owner,pin:'1234',permissions:['billing']} as any]));
    await advance(1000);
    expect(mocks.saveSync).not.toHaveBeenCalled();
  });
  it('initializes from a later poll after the first request fails',async()=>{
    mocks.getSync.mockResolvedValueOnce({success:false,error:'NETWORK_OFFLINE'}).mockResolvedValue(snapshot('recovered-menu'));
    await render();expect(latest.isTenantDataReady).toBe(false);
    await advance(3500);
    expect(latest.isTenantDataReady).toBe(true);
    expect(latest.menuItems.map(x=>x.name)).toEqual(['recovered-menu']);
  });
  it('does not apply an old restaurant response after switching tenants',async()=>{
    let resolveOld:(value:any)=>void;
    mocks.getSync.mockImplementation((tenant:string)=>tenant==='restaurant-a'?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(snapshot('restaurant-b-only')));
    await render();await render('restaurant-b');
    await act(async()=>{resolveOld!(snapshot('restaurant-a-only'));});
    expect(latest.menuItems.map(x=>x.name)).toEqual(['restaurant-b-only']);
    expect(mocks.saveLocal).not.toHaveBeenCalledWith('restaurant-a',expect.anything());
  });
  it('ignores an old tenant that finishes writing its local cache after a switch',async()=>{
    let finishOldCache:()=>void;
    mocks.getSync.mockImplementation((tenant:string)=>Promise.resolve(snapshot(tenant+'-only')));
    mocks.saveLocal.mockImplementation((tenant:string)=>tenant==='restaurant-a'?new Promise<void>(resolve=>{finishOldCache=resolve;}):Promise.resolve());
    await render();await render('restaurant-b');
    await act(async()=>{finishOldCache!();});
    expect(latest.menuItems.map(x=>x.name)).toEqual(['restaurant-b-only']);
    expect(latest.isTenantDataReady).toBe(true);
  });
});
