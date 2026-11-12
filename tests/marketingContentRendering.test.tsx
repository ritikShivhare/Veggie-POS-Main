import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import ProductPage from "../src/features/marketing/pages/ProductPage";
import PricingPage from "../src/features/marketing/pages/PricingPage";
import { renderMarketingPage } from "../src/entry-marketing";
import { getPageSeo, buildSitemap, SITE_ORIGIN } from "../shared/marketing-seo";

const noop = () => {};
const guides = [
  "/resources/restaurant-food-cost-calculation",
  "/resources/restaurant-order-payment-workflow",
  "/resources/restaurant-staff-access-checklist",
  "/resources/restaurant-pos-cost-guide",
  "/resources/single-outlet-setup-checklist",
  "/resources/kot-vs-kds",
];

describe("Complete marketing content", () => {
  it("includes every tab panel in initial HTML while displaying only the selected module", () => {
    const doc = new JSDOM(renderToStaticMarkup(<ProductPage onNavigate={noop} />)).window.document;
    const tabs = [...doc.querySelectorAll('[role="tab"]')];
    expect(tabs.length).toBeGreaterThan(1);
    for (const tab of tabs) {
      const id = tab.getAttribute("aria-controls");
      expect(id).toBeTruthy();
      const panel = doc.getElementById(id!);
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.querySelectorAll("li").length).toBeGreaterThan(0);
      expect(panel?.hasAttribute("hidden")).toBe(tab.getAttribute("aria-selected") !== "true");
    }
    expect(doc.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
  });

  it("includes every FAQ answer in initial HTML with accessible question controls", () => {
    const doc = new JSDOM(renderToStaticMarkup(<PricingPage onNavigate={noop} />)).window.document;
    const questions = [...doc.querySelectorAll("button")].filter(button => button.textContent?.trim().endsWith("?"));
    expect(questions.length).toBeGreaterThan(0);
    for (const question of questions) {
      const id = question.getAttribute("aria-controls");
      expect(id).toBeTruthy();
      const answer = doc.getElementById(id!);
      expect(answer?.textContent?.trim().length).toBeGreaterThan(30);
      expect(answer?.hasAttribute("hidden")).toBe(question.getAttribute("aria-expanded") !== "true");
    }
  });

  it.each(["/solutions/cafes", ...guides])("renders a complete public document and search destination for %s", path => {
    const doc = new JSDOM(renderMarketingPage(path)).window.document;
    expect(doc.querySelectorAll("main h1")).toHaveLength(1);
    expect(doc.querySelectorAll("main h2").length).toBeGreaterThan(1);
    expect(doc.querySelector('main a[href="/contact"]')).not.toBeNull();
    expect(getPageSeo(path).indexable).toBe(true);
    expect(getPageSeo(path).canonical).toBe(SITE_ORIGIN + path);
    const xml = new JSDOM(buildSitemap(), { contentType: "application/xml" }).window.document;
    expect([...xml.querySelectorAll("loc")].map(node => node.textContent)).toContain(SITE_ORIGIN + path);
  });

  it("gives all six resource cards native links to independently readable guides", () => {
    const doc = new JSDOM(renderMarketingPage("/resources")).window.document;
    const hrefs = [...doc.querySelectorAll("main a[href]")].map(link => link.getAttribute("href"));
    for (const guide of guides) expect(hrefs).toContain(guide);
  });
});
