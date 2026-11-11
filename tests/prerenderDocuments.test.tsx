import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { generatePublicDocuments } from "../scripts/seo-documents";
import { renderMarketingPage } from "../src/entry-marketing";
import { PUBLIC_PAGES } from "../shared/marketing-seo";
it("generates real public content without JS while retaining an empty private shell", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aatmyam-prerender-"));
  try {
    const directory = path.join(root, "client");
    await mkdir(directory);
    const template =
      '<html><head><!-- seo:start --><!-- seo:end --></head><body><div id="root"></div><script src="/assets/client.js"></script></body></html>';
    await generatePublicDocuments(directory, template, renderMarketingPage);
    const titles = [];
    for (const page of PUBLIC_PAGES) {
      const file = path.join(
        directory,
        page.path === "/" ? "index.html" : page.path.slice(1) + "/index.html",
      );
      const doc = new JSDOM(await readFile(file, "utf8")).window.document;
      expect(
        doc.querySelector("h1")?.textContent?.trim().length,
      ).toBeGreaterThan(5);
      expect(doc.querySelector("#root")!.textContent!.length).toBeGreaterThan(
        200,
      );
      expect(
        doc.querySelector('script[src="/assets/client.js"]'),
      ).not.toBeNull();
      titles.push(doc.title);
    }
    expect(new Set(titles).size).toBe(PUBLIC_PAGES.length);
    const pricing = new JSDOM(
      await readFile(path.join(directory, "pricing/index.html"), "utf8"),
    ).window.document;
    expect(pricing.querySelector("h1")?.textContent).toContain(
      "Simple, honest pricing.",
    );
    const shell = new JSDOM(
      await readFile(path.join(root, "server-shell.html"), "utf8"),
    ).window.document;
    expect(shell.querySelector("#root")?.textContent).toBe("");
    expect(await readFile(path.join(directory, "llms.txt"), "utf8")).toContain(
      "# Aatmyam POS",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("refuses to prerender private pages and fails loudly on a broken Vite template", async () => {
  expect(() => renderMarketingPage("/login")).toThrow("private or unknown");
  await expect(
    generatePublicDocuments("/unused", "<html/>", renderMarketingPage),
  ).rejects.toThrow("head markers");
});
