import express from "express";
import http from "node:http";
import path from "node:path";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { beforeAll, afterAll, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { mountStaticClient } from "../server/static-client";
import {
  replaceSeoHead,
  SITE_ORIGIN,
  buildSitemap,
  buildRobots,
  buildLlms,
} from "../shared/marketing-seo";
let root: string, server: http.Server, base: string;
const shell =
  '<html><head><!-- seo:start --><title>default</title><!-- seo:end --></head><body><div id="root"></div></body></html>';
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "aatmyam-seo-"));
  const dir = path.join(root, "client");
  await mkdir(path.join(dir, "pricing"), { recursive: true });
  await mkdir(path.join(dir, "assets"));
  await writeFile(path.join(root, "server-shell.html"), shell);
  await writeFile(
    path.join(dir, "index.html"),
    replaceSeoHead(shell, "/").replace(
      '<div id="root"></div>',
      '<div id="root"><h1>Public restaurant website</h1></div>',
    ),
  );
  await writeFile(
    path.join(dir, "pricing", "index.html"),
    replaceSeoHead(shell, "/pricing").replace(
      '<div id="root"></div>',
      '<div id="root"><h1>Subscription pricing</h1></div>',
    ),
  );
  for (const [file, text] of Object.entries({
    "robots.txt": buildRobots(),
    "sitemap.xml": buildSitemap(),
    "llms.txt": buildLlms(),
    "assets/app-12345678.js": "export const app=true;",
    "assets/app-12345678.js.map": "secret source map",
  }))
    await writeFile(path.join(dir, file), text);
  const app = express();
  mountStaticClient(app, dir);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await rm(root, { recursive: true, force: true });
});
it("serves page-specific content and metadata before JavaScript runs", async () => {
  const res = await fetch(base + "/pricing");
  expect(res.status).toBe(200);
  const doc = new JSDOM(await res.text()).window.document;
  expect(doc.querySelector("h1")?.textContent).toBe("Subscription pricing");
  expect(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
    SITE_ORIGIN + "/pricing",
  );
  expect(res.headers.get("x-robots-tag")).toBeNull();
});
it.each([
  "/login",
  "/signup",
  "/terminal",
  "/?subdomain=admin",
  "/?tenant=private",
  "/?token=private",
])("serves a noindex shell without marketing content for %s", async (url) => {
  const res = await fetch(base + url);
  expect(res.status).toBe(200);
  expect(res.headers.get("x-robots-tag")).toContain("noindex");
  const doc = new JSDOM(await res.text()).window.document;
  expect(doc.querySelector("#root")?.textContent).toBe("");
  expect(
    doc.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toContain("noindex");
});
it.each([
  "/no-such-page",
  "/no-such-page/",
  "/assets/missing.js",
  "/missing.css",
  "/favicon.ico",
  "/assets/app-12345678.js.map",
  "/server.cjs",
  "/server%2ecjs.map",
])("returns actual 404 for unknown/private file %s", async (url) => {
  const res = await fetch(base + url);
  expect(res.status).toBe(404);
  expect(res.headers.get("x-robots-tag")).toContain("noindex");
  expect(await res.text()).not.toContain('<div id="root">');
  expect((await fetch(base + url, { method: "HEAD" })).status).toBe(404);
});
it.each([
  ["/robots.txt", "text/plain"],
  ["/sitemap.xml", "application/xml"],
  ["/llms.txt", "text/plain"],
])("serves valid discovery resource %s", async (url, type) => {
  const res = await fetch(base + url);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain(type);
  expect(await res.text()).not.toContain("<html");
});
it("redirects trailing-slash documents and preserves immutable asset caching", async () => {
  const redirect = await fetch(base + "/pricing/", { redirect: "manual" });
  expect(redirect.status).toBe(301);
  expect(redirect.headers.get("location")).toBe("/pricing");
  const asset = await fetch(base + "/assets/app-12345678.js");
  expect(asset.status).toBe(200);
  expect(asset.headers.get("cache-control")).toContain("immutable");
});
it.each(["/login/", "/signup/", "/terminal/", "/l%6fgin"])(
  "normalizes app route %s before client routing, retaining query parameters",
  async (url) => {
    const res = await fetch(base + url + "?utm_source=qa", {
      redirect: "manual",
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(
      decodeURIComponent(url).replace(/\/+$/, "") + "?utm_source=qa",
    );
  },
);
it("normalizes generated index aliases and keeps private query variants out of the public HTML", async () => {
  const canonical = await fetch(base + "/pricing/index.html", {
    redirect: "manual",
  });
  expect(canonical.status).toBe(301);
  expect(canonical.headers.get("location")).toBe("/pricing");
  const res = await fetch(base + "/pricing/index.html?token=SECRET");
  expect(res.headers.get("x-robots-tag")).toContain("noindex");
  const doc = new JSDOM(await res.text()).window.document;
  expect(doc.querySelector("#root")?.textContent).toBe("");
  expect(doc.head.innerHTML).not.toContain("SECRET");
  const slash = await fetch(base + "//pricing", { redirect: "manual" });
  expect(slash.headers.get("location")).toBe("/pricing");
});
