// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import React, {act} from "react";
import {createRoot} from "react-dom/client";
import PinLogin from "../src/features/staff/PinLogin";

const routes = readFileSync(new NodeURL("../routes/auth.routes.ts", import.meta.url), "utf8");

describe("P1 emergency unlock safeguards", () => {
  it("enforces a strict dedicated unlock rate limit", () => {
    expect(routes).toMatch(/const unlockLimiter = rateLimit\(\{ windowMs: 15 \* 60 \* 1000, limit: 5/);
    expect(routes).toContain("router.use('/auth/unlock-override', unlockLimiter)");
  });
  it("requires an existing tenant plus both owner email and unlock key", () => {
    expect(routes).toContain('if (!targetTenant) return res.status(403)');
    expect(routes).toContain('!ownerEmail.trim()');
    expect(routes).toContain('!masterPin.trim()');
    expect(routes).toContain('if (!isOwnerEmailMatch || (!isMasterCode && !isOwnerPinMatch))');
  });
  it("does not submit an email-only unlock and submits both credentials together", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
    Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
    Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open');}});
    const fetchMock=vi.fn(async (url:string) => ({ok:false,json:async()=>url.includes('lockout-status')?{success:true,locked:true,cooldownSeconds:300,tier:1}:{success:false,message:'Fixture request denied'}}));
    vi.stubGlobal('fetch',fetchMock);
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    const enter=async(id:string,value:string)=>act(async()=>{
      const input=host.querySelector('#'+id) as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    try {
      await act(async()=>root.render(React.createElement(PinLogin,{tenantId:'fixture-tenant',restaurantName:'Fixture restaurant',onLoginSuccess:vi.fn()})));
      await act(async()=>(host.querySelector('#pin-login-owner-override-btn') as HTMLButtonElement).click());
      await enter('owner-override-email','owner@fixture.test');
      const form=host.querySelector('#owner-override-email')!.closest('form')!;
      await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
      expect(fetchMock.mock.calls.filter(call=>call[0].includes('unlock-override'))).toHaveLength(0);
      expect((host.querySelector('#pin-login-submit-unlock-override-btn') as HTMLButtonElement).disabled).toBe(true);
      await enter('owner-override-pin','fixture-unlock-key');
      await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
      const submitted=fetchMock.mock.calls.find(call=>call[0].includes('unlock-override')) as unknown as [string,RequestInit];
      expect(submitted).toBeDefined();
      expect(JSON.parse(submitted[1].body as string)).toMatchObject({masterPin:'fixture-unlock-key',ownerEmail:'owner@fixture.test'});
    } finally {
      await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();
    }
  });
});
