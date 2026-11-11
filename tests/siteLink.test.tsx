// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import SiteLink from "../src/features/marketing/components/SiteLink";
import { updateDocumentSeo } from "../src/features/marketing/seo";
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it.each([
  {},
  { ctrlKey: true },
  { metaKey: true },
  { shiftKey: true },
  { altKey: true },
  { button: 1 },
])(
  "preserves native modified clicks while intercepting only ordinary SPA navigation: %j",
  (options) => {
    const navigate = vi.fn();
    act(() =>
      root.render(
        <SiteLink href="/pricing" onNavigate={navigate}>
          Pricing
        </SiteLink>,
      ),
    );
    let intercepted = false;
    container.addEventListener("click", (e) => {
      intercepted = e.defaultPrevented;
      e.preventDefault();
    });
    act(() =>
      container
        .querySelector("a")!
        .dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            ...options,
          }),
        ),
    );
    const ordinary = Object.keys(options).length === 0;
    expect(intercepted).toBe(ordinary);
    expect(navigate).toHaveBeenCalledTimes(ordinary ? 1 : 0);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/pricing");
  },
);
it("preserves new-tab targets and download semantics", () => {
  const navigate = vi.fn();
  act(() =>
    root.render(
      <SiteLink href="/pricing" target="_blank" onNavigate={navigate}>
        Pricing
      </SiteLink>,
    ),
  );
  container.addEventListener("click", (e) => e.preventDefault());
  act(() =>
    container
      .querySelector("a")!
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
  );
  expect(navigate).not.toHaveBeenCalled();
});
it("updates metadata without duplicates after client navigation and keeps auth queries private", () => {
  history.replaceState({}, "", "/pricing");
  updateDocumentSeo();
  expect(document.title).toBe(
    "Restaurant POS Pricing & Subscription Plans | Aatmyam POS",
  );
  expect(document.querySelectorAll("title")).toHaveLength(1);
  history.pushState({}, "", "/login?token=do-not-publish");
  updateDocumentSeo();
  updateDocumentSeo();
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toContain("noindex");
  expect(document.head.innerHTML).not.toContain("do-not-publish");
  expect(document.querySelectorAll("title")).toHaveLength(1);
});
