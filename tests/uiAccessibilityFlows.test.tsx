// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import Sidebar from '../src/features/shared/components/Sidebar';
import {Dialog} from '../src/features/shared/components/ui/Dialog';
import {ToastContainer} from '../src/features/shared/components/ToastContainer';
import {toast} from '../src/features/shared/services/toast';

let host:HTMLDivElement,root:Root;
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open');}});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>{root.unmount();toast.clearAll();});host.remove();vi.unstubAllGlobals();});
function sidebar(open:boolean,close=vi.fn()){
 return <Sidebar activeTab="dashboard" setActiveTab={vi.fn()} currentStaff={{id:'owner',name:'Test Owner',role:'Owner',pin:'',permissions:['billing','inventory','settings','reports']}} activeShift={null} onLogout={vi.fn()} onShiftAction={vi.fn()} isOpenMobile={open} onCloseMobile={close} activeTenant={{id:'tenant',tenantId:'tenant',name:'Test store',created:'2026-11-01',status:'active'}}/>;
}
it('removes the closed mobile menu from keyboard/accessibility navigation',async()=>{
 await act(async()=>root.render(sidebar(false)));
 const aside=host.querySelector('aside')!;
 expect(aside.hasAttribute('inert')).toBe(true);expect(aside.getAttribute('aria-hidden')).toBe('true');
 expect(host.querySelector('[aria-current=page]')?.getAttribute('aria-label')).toBe('Dashboard');
});
it('provides a named mobile drawer, close action and Escape behavior',async()=>{
 const close=vi.fn();await act(async()=>root.render(sidebar(true,close)));
 expect(host.querySelector('aside')?.getAttribute('role')).toBe('dialog');
 expect(host.textContent).toContain('Aatmyam Pos');expect(host.textContent).not.toContain('VEGGIE');
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(close).toHaveBeenCalledOnce();
 await act(async()=>(host.querySelector('[aria-label="Close menu"]') as HTMLButtonElement).click());
 expect(close).toHaveBeenCalledTimes(2);
});
it('returns an escaped native dialog cancel request to the controlling parent',async()=>{
 const change=vi.fn();await act(async()=>root.render(<Dialog open onOpenChange={change} title="Switch outlet"><input aria-label="Store"/></Dialog>));
 const dialog=host.querySelector('dialog')!;
 expect(dialog.open).toBe(true);expect(dialog.getAttribute('aria-modal')).toBe('true');
 expect(host.querySelector('[aria-label="Close dialog"]')).not.toBeNull();
 await act(async()=>dialog.dispatchEvent(new Event('cancel',{cancelable:true})));
 expect(change).toHaveBeenCalledWith(false);
});
it('announces actual error and information toasts and allows dismiss',async()=>{
 await act(async()=>{root.render(<ToastContainer/>);});
 await act(async()=>{toast.error('Could not connect','Connection',0);toast.info('Store ready','Ready',0);});
 expect(host.querySelector('[role=alert]')?.getAttribute('aria-live')).toBe('assertive');
 expect(host.querySelector('[role=status]')?.getAttribute('aria-live')).toBe('polite');
 await act(async()=>(host.querySelector('[aria-label="Dismiss toast"]') as HTMLButtonElement).click());
 expect(host.querySelectorAll('[role=alert]')).toHaveLength(0);
});
