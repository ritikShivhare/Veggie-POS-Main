// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactPage from "../src/features/marketing/pages/ContactPage";

const storageKey = "veggiepos_walkthrough_lead";
const details = {
  fullName: "Demo owner",
  email: "owner@example.invalid",
  phone: "+91 90000 00000",
  restaurantName: "Demo cafe",
  address: "Demo address",
  format: "cafe-bakery",
  outletCount: "1",
  primaryGoal: "Order entry and billing",
  preferredDate: "2099-12-12",
  preferredTime: "afternoon",
  notes: "",
};
const lead = { ...details, id: "lead-server-confirmed", createdAt: "2026-11-12T00:00:00Z", status: "new" };
const confirmed = { success: true, lead, isRescheduled: false, message: "Walkthrough request successfully recorded." };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
let host: HTMLDivElement;
let root: Root;
const network = vi.fn<typeof fetch>();

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  network.mockReset();
  vi.stubGlobal("fetch", network);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function render() {
  await act(async () => root.render(<ContactPage onNavigate={() => {}} />));
}

async function fillForm() {
  await act(async () => {
    const fields: [string, string][] = [
      ['input[placeholder="e.g. Ritik Sharma"]', details.fullName],
      ['input[type="email"]', details.email],
      ['input[type="tel"]', details.phone],
      ['input[placeholder="e.g. Spice Route Kitchens"]', details.restaurantName],
      ["textarea", details.address],
    ];
    for (const [selector, value] of fields) {
      const element = host.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

async function submit() {
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

function expectUnconfirmed() {
  expect(host.textContent).not.toContain("Walkthrough Request Received");
  expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/couldn.t confirm|unable to confirm/i);
  expect((host.querySelector('input[type="email"]') as HTMLInputElement).value).toBe(details.email);
  expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe(details.address);
  expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  expect(localStorage.getItem(storageKey)).toBeNull();
}

describe("Demo enquiries require server confirmation", () => {
  it.each([
    ["HTTP validation failure", 400, { success: false, message: "Required details missing" }],
    ["HTTP server failure", 500, { success: false, error: "Database unavailable" }],
    ["HTTP failure with a misleading success payload", 500, confirmed],
    ["unsuccessful payload with a lead", 200, { success: false, lead }],
    ["missing lead", 200, { success: true }],
    ["missing lead identity", 200, { success: true, lead: { ...details } }],
    ["blank lead identity", 200, { success: true, lead: { ...lead, id: " " } }],
    ["truthy non-boolean success", 200, { success: "true", lead }],
    ["empty result", 200, null],
  ])("keeps entered details and shows an error for %s", async (_name, status, body) => {
    network.mockResolvedValue(reply(body, status as number));
    await render();
    await fillForm();
    await submit();
    expectUnconfirmed();
  });

  it("keeps the form available when the network fails", async () => {
    network.mockRejectedValue(new TypeError("Failed to fetch"));
    await render();
    await fillForm();
    await submit();
    expectUnconfirmed();
  });

  it("does not treat an HTML response as a saved enquiry", async () => {
    network.mockResolvedValue(new Response("<html>upstream error</html>", { status: 502 }));
    await render();
    await fillForm();
    await submit();
    expectUnconfirmed();
  });

  it("shows success only after a pending request returns its server lead ID", async () => {
    let finish!: (value: Response) => void;
    network.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await render();
    await fillForm();
    await submit();
    expect(host.textContent).not.toContain("Walkthrough Request Received");
    expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(localStorage.getItem(storageKey)).toBeNull();
    await act(async () => finish(reply(confirmed)));
    expect(host.textContent).toContain("Walkthrough Request Received");
    expect(host.textContent).toContain("ID: lead-server-confirmed");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(JSON.parse(localStorage.getItem(storageKey)!).id).toBe("lead-server-confirmed");
    const [url, options] = network.mock.calls[0];
    expect(url).toBe("/api/leads/walkthrough");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toMatchObject({ fullName: details.fullName, email: details.email, address: details.address });
  });

  it("allows an intentional retry and clears the error after confirmed success", async () => {
    network.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(reply(confirmed));
    await render();
    await fillForm();
    await submit();
    expectUnconfirmed();
    await submit();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain("ID: lead-server-confirmed");
    expect(network).toHaveBeenCalledTimes(2);
  });

  it("retains real success when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage disabled", "SecurityError"); });
    network.mockResolvedValue(reply(confirmed));
    await render();
    await fillForm();
    await submit();
    expect(host.textContent).toContain("Walkthrough Request Received");
    expect(host.textContent).toContain("ID: lead-server-confirmed");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(["lead-123456", "lead-server-confirmed"])("uses cached %s only to prefill, without claiming server confirmation", async id => {
    localStorage.setItem(storageKey, JSON.stringify({ ...details, id }));
    await render();
    expect(host.querySelector("form")).not.toBeNull();
    expect(host.textContent).not.toContain("Walkthrough Request Received");
    expect((host.querySelector('input[type="email"]') as HTMLInputElement).value).toBe(details.email);
    expect(network).not.toHaveBeenCalled();
  });

  it("describes an expired fake cached request as browser details rather than a saved booking", async () => {
    localStorage.setItem(storageKey, JSON.stringify({ ...details, id: "lead-123456", preferredDate: "2000-01-01" }));
    await render();
    expect(host.querySelector("form")).not.toBeNull();
    expect(host.textContent).toMatch(/restored from this browser/i);
    expect(host.textContent).not.toContain("Your previous walkthrough slot");
    expect(host.textContent).not.toContain("Your restaurant details are already saved");
    expect(host.textContent).not.toContain("Walkthrough Request Received");
    expect((host.querySelector('input[type="email"]') as HTMLInputElement).value).toBe(details.email);
    expect(network).not.toHaveBeenCalled();
  });

  it("does not issue duplicate requests for overlapping form submissions", async () => {
    let finish!: (value: Response) => void;
    network.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await render();
    await fillForm();
    await act(async () => {
      const form = host.querySelector("form")!;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(network).toHaveBeenCalledTimes(1);
    await act(async () => finish(reply(confirmed)));
    expect(host.textContent).toContain("ID: lead-server-confirmed");
  });

  it("returns to an editable error state if the network never responds", async () => {
    vi.useFakeTimers();
    network.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    await render();
    await fillForm();
    await submit();
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expectUnconfirmed();
  });
});
