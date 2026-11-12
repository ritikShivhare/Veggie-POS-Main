// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MarketingApp from "../src/features/marketing/MarketingApp";

let host: HTMLDivElement;
let root: Root;
const noop = () => {};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "scrollTo").mockImplementation(noop);
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(path: string) {
  history.replaceState({}, "", path);
  await act(async () => root.render(<MarketingApp onOpenLogin={noop} onOpenLegal={noop} onOpenSignup={noop} />));
}

it("switches the visible product panel without removing the other public explanations", async () => {
  await render("/product");
  const inventory = host.querySelector('#product-tab-inventory') as HTMLButtonElement;
  expect(inventory).not.toBeNull();
  const billingPanel = host.querySelector('#product-panel-billing') as HTMLElement;
  const inventoryPanel = host.querySelector('#product-panel-inventory') as HTMLElement;
  expect(inventoryPanel.hidden).toBe(true);
  await act(async () => inventory.click());
  expect(inventory.getAttribute("aria-selected")).toBe("true");
  expect(inventoryPanel.hidden).toBe(false);
  expect(billingPanel.hidden).toBe(true);
  expect(billingPanel.textContent?.length).toBeGreaterThan(30);
});

it("expands FAQ answers that already exist in the document", async () => {
  await render("/pricing");
  const question = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("internet disconnects"))!;
  const answerId = question.getAttribute("aria-controls");
  expect(answerId).toBeTruthy();
  const answer = document.getElementById(answerId!)!;
  expect(answer.hidden).toBe(true);
  await act(async () => question.click());
  expect(answer.hidden).toBe(false);
  expect(question.getAttribute("aria-expanded")).toBe("true");
});

it("opens a guide through its native link and restores the resource list on browser Back", async () => {
  await render("/resources");
  const guide = host.querySelector('a[href="/resources/restaurant-pos-cost-guide"]')!;
  expect(guide).not.toBeNull();
  await act(async () => guide.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  expect(location.pathname).toBe("/resources/restaurant-pos-cost-guide");
  expect(host.querySelector("main article")).not.toBeNull();
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://aatmyam-marketing-preview.onrender.com/resources/restaurant-pos-cost-guide");
  await act(async () => {
    history.back();
    await new Promise(resolve => window.addEventListener("popstate", resolve, { once: true }));
  });
  expect(location.pathname).toBe("/resources");
  expect(host.querySelector('a[href="/resources/restaurant-pos-cost-guide"]')).not.toBeNull();
});
