import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import http from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { configureProductionStatic } from "../server/http/productionStatic";

describe("Production client asset boundary", () => {
  let dir: string;
  let server: http.Server;
  let base: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "veggie-static-"));
    await mkdir(path.join(dir, "assets"));
    for (const [name, content] of Object.entries({
      "index.html": '<div id="root">client</div>',
      "server.cjs": "private backend",
      "server.cjs.map": "private sources",
      "assets/app.js": 'console.log("client")',
      "assets/app.js.map": "private source map",
    }))
      await writeFile(path.join(dir, name), content);
    const app = express();
    configureProductionStatic(app, dir);
    server = http.createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  it.each([
    "/server.cjs",
    "/server.cjs.map",
    "/assets/app.js.map",
    "/assets/missing.js",
    "/missing.js",
    "/missing.css",
    "/favicon.ico",
    "/assets/../server.cjs",
    "/server%2ecjs",
    "/assets/missing",
  ])("returns 404 for private or missing resource %s", async (resource) => {
    expect((await fetch(base + resource)).status).toBe(404);
  });
  it("serves client JavaScript and document deep links", async () => {
    const asset = await fetch(base + "/assets/app.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect(await asset.text()).toBe('console.log("client")');
    const document = await fetch(base + "/pricing");
    expect(document.status).toBe(200);
    expect(await document.text()).toContain('id="root"');
  });
});
