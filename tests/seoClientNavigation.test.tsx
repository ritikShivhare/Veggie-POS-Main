// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import MarketingApp from "../src/features/marketing/MarketingApp";
import { updateDocumentSeo } from "../src/features/marketing/seo";
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("keeps authenticated or post-signup UI private even when it is displayed at the home URL", () => {
  history.replaceState({}, "", "/");
  updateDocumentSeo({ privateView: true });
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toContain("noindex");
  expect(
    document.querySelector('script[type="application/ld+json"]'),
  ).toBeNull();
  updateDocumentSeo({ privateView: false });
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toMatch(/^index,/);
});
it("refreshes query-only metadata on same-route link clicks and popstate", () => {
  history.replaceState({}, "", "/pricing?token=private");
  const noop = () => {};
  act(() =>
    root.render(
      <MarketingApp
        onOpenLogin={noop}
        onOpenLegal={noop}
        onOpenSignup={noop}
      />,
    ),
  );
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toContain("noindex");
  act(() =>
    container
      .querySelector("#nav-link-pricing")!
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
  );
  expect(location.search).toBe("");
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toMatch(/^index,/);
  act(() => {
    history.replaceState({}, "", "/pricing?token=private");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toContain("noindex");
});
