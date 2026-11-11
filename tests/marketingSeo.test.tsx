import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, it, expect } from "vitest";
import MarketingApp from "../src/features/marketing/MarketingApp";
import MarketingNav from "../src/features/marketing/components/MarketingNav";
import MarketingFooter from "../src/features/marketing/components/MarketingFooter";
const noop = () => {};
describe("Public content without browser JavaScript", () => {
  it("renders the requested marketing page without browser globals", () => {
    const html = renderToStaticMarkup(
      <MarketingApp
        initialRoute="/pricing"
        onOpenLogin={noop}
        onOpenLegal={noop}
        onOpenSignup={noop}
      />,
    );
    expect(
      new JSDOM(html).window.document.querySelector("h1")?.textContent,
    ).toContain("Simple, honest pricing.");
  });
  it("exposes navigation as real URLs rather than requiring JavaScript clicks", () => {
    const html = renderToStaticMarkup(
      <>
        <MarketingNav currentRoute="/" onNavigate={noop} onOpenLogin={noop} />
        <MarketingFooter
          onNavigate={noop}
          onOpenLogin={noop}
          onOpenLegal={noop}
        />
      </>,
    );
    const doc = new JSDOM(html).window.document;
    const hrefs = [...doc.querySelectorAll("a[href]")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/",
        "/product",
        "/solutions",
        "/roi",
        "/pricing",
        "/about",
        "/resources",
        "/contact",
        "/login",
        "/privacy",
        "/terms",
        "/refund-policy",
      ]),
    );
  });
});
