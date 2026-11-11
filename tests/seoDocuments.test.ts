import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import {
  PUBLIC_PAGES,
  SITE_ORIGIN,
  getPageSeo,
  renderSeoHead,
  replaceSeoHead,
  buildSitemap,
  buildRobots,
  buildLlms,
} from "../shared/marketing-seo";
describe("Public search documents", () => {
  it("gives public pages unique metadata and canonical URLs on the chosen hostname", () => {
    expect(new Set(PUBLIC_PAGES.map((p) => p.title)).size).toBe(
      PUBLIC_PAGES.length,
    );
    expect(new Set(PUBLIC_PAGES.map((p) => p.description)).size).toBe(
      PUBLIC_PAGES.length,
    );
    for (const page of PUBLIC_PAGES) {
      const seo = getPageSeo(page.path);
      expect(seo.indexable).toBe(true);
      expect(seo.canonical).toBe(SITE_ORIGIN + page.path);
    }
    expect(getPageSeo("/pricing/?utm_source=qa").canonical).toBe(
      SITE_ORIGIN + "/pricing",
    );
  });
  it.each([
    "/login",
    "/signup",
    "/terminal",
    "/?subdomain=admin",
    "/?tenant=private",
    "/?token=private",
    "/?code=private",
    "/unknown",
    "/login?utm_source=qa",
  ])("does not index account or unknown URLs: %s", (url) => {
    const seo = getPageSeo(url);
    expect(seo.indexable).toBe(false);
    expect(seo.robots).toContain("noindex");
    expect(seo.canonical).not.toContain("?");
  });
  it("uses valid, truthful structured data without fabricated ratings", () => {
    const doc = new JSDOM("<head>" + renderSeoHead("/product") + "</head>")
      .window.document;
    const data = JSON.parse(
      doc.querySelector('script[type="application/ld+json"]')!.textContent!,
    );
    expect(data["@context"]).toBe("https://schema.org");
    expect(
      data["@graph"].some(
        (x: any) =>
          x["@type"] === "SoftwareApplication" && x.name === "Aatmyam POS",
      ),
    ).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|reviewRating/);
    expect(
      doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe(SITE_ORIGIN + "/product");
    expect(
      doc.querySelector('meta[property="og:image"]')?.getAttribute("content"),
    ).toBe(SITE_ORIGIN + "/aatmyam-logo.webp");
  });
  it("replaces metadata without duplicate titles and never reflects secrets into the head", () => {
    const template =
      '<html><head><!-- seo:start --><title>old</title><!-- seo:end --></head><body><div id="root"></div></body></html>';
    const html = replaceSeoHead(template, "/login?token=SECRET&tenant=PRIVATE");
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll("title")).toHaveLength(1);
    expect(html).not.toContain("SECRET");
    expect(html).not.toContain("PRIVATE");
    expect(html).toContain("noindex");
    expect(html).toContain('id="root"');
  });
  it("publishes a valid public-only sitemap, robots policy and AI-readable summary", () => {
    const sitemap = new JSDOM(buildSitemap(), {
      contentType: "application/xml",
    }).window.document;
    const urls = [...sitemap.querySelectorAll("loc")].map((x) => x.textContent);
    expect(urls).toEqual(PUBLIC_PAGES.map((p) => SITE_ORIGIN + p.path));
    expect(urls.some((u) => /login|terminal|signup|api|\?/.test(u!))).toBe(
      false,
    );
    expect(buildRobots()).toContain("Sitemap: " + SITE_ORIGIN + "/sitemap.xml");
    expect(buildRobots()).not.toContain("Disallow: /login");
    expect(buildLlms()).toContain("[Product](" + SITE_ORIGIN + "/product)");
    expect(buildLlms()).not.toMatch(/#1|guaranteed ranking|five.star/i);
  });
});
