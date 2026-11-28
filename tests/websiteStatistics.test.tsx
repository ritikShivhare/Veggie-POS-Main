// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.aatmyampos.in/"}
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createWebsiteAnalytics, ANALYTICS_CONSENT_KEY } from "../src/features/marketing/websiteAnalytics";
import WebsiteStatistics from "../src/features/marketing/components/WebsiteStatistics";

const state = vi.hoisted(() => ({ currentStaff: null as object | null, isSessionBootstrapComplete: false, showSignup: false, showAdminPanel: false, showTerminalLogin: false }));
let analytics: ReturnType<typeof createWebsiteAnalytics>;
vi.mock("../src/features/shared/context/AppContext", () => ({ useAppContext: () => state }));
vi.mock("../src/features/marketing/websiteAnalytics", async importOriginal => ({ ...await importOriginal<object>(), getWebsiteAnalytics: () => analytics }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear(); history.replaceState({}, "", "/");
  Object.assign(state, { currentStaff: null, isSessionBootstrapComplete: false, showSignup: false, showAdminPanel: false, showTerminalLogin: false });
  document.querySelector("#aatmyam-website-google-tag")?.remove();
  delete (window as any).dataLayer;
  analytics = createWebsiteAnalytics(window);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); analytics.dispose(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const render = async () => { await act(async () => root.render(<WebsiteStatistics />)); };
const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find(node => node.textContent === label)!;
  expect(button).toBeTruthy(); await act(async () => button.click());
};

it("waits for session restoration before offering or loading public statistics", async () => {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, "granted");
  await render(); expect(host.textContent).toBe(""); expect(document.querySelector("#aatmyam-website-google-tag")).toBeNull();
  state.isSessionBootstrapComplete = true; state.currentStaff = { role: "Owner" };
  await render(); expect(host.textContent).toBe(""); expect(document.querySelector("#aatmyam-website-google-tag")).toBeNull();
});
it("lets an anonymous visitor refuse, reopen preferences and allow statistics", async () => {
  state.isSessionBootstrapComplete = true; await render();
  expect(host.textContent).toContain("Cookies & privacy"); expect(host.querySelector('a[href="/privacy"]')).not.toBeNull();
  await click("Reject optional cookies"); expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("denied");
  expect(document.querySelector("#aatmyam-website-google-tag")).toBeNull();
  await click("Cookie settings"); await click("Accept optional cookies");
  expect(document.querySelector("#aatmyam-website-google-tag")).not.toBeNull();
  expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("granted");
});
it("removes the public control and blocks measurement on terminal navigation", async () => {
  state.isSessionBootstrapComplete = true; await render(); await click("Accept optional cookies");
  await act(async () => { history.pushState({}, "", "/login?tenant=synthetic"); });
  expect(host.textContent).toBe(""); expect((window as any)["ga-disable-G-WPERCLQYVR"]).toBe(true);
});
it("honours a refusal made in another tab", async () => {
  state.isSessionBootstrapComplete = true; localStorage.setItem(ANALYTICS_CONSENT_KEY, "granted"); await render();
  await act(async () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "denied"); window.dispatchEvent(new StorageEvent("storage", { key: ANALYTICS_CONSENT_KEY, newValue: "denied" }));
  });
  expect((window as any)["ga-disable-G-WPERCLQYVR"]).toBe(true);
});
