import express from 'express';
import http from 'node:http';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {afterAll, beforeAll, expect, it, vi} from 'vitest';
import {mountStaticClient} from '../server/static-client';
import {offlineShellPlugin} from '../service-worker-plugin';

let directory: string, server: http.Server, base: string;
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'aatmyam-cache-'));
  await mkdir(path.join(directory, 'assets'));
  for (const [file, content] of Object.entries({'index.html':'<html>new app</html>', 'sw.js':'// worker', 'assets/app-a1B2c3D4.js':'export const current = true;', 'assets/app-a1B2c3D4.css':'body{}', 'assets/app.js':'// unversioned', 'icon.svg':'<svg/>', 'manifest.webmanifest':'{}'})) {
    await writeFile(path.join(directory, file), content);
  }
  const app = express();
  app.get('/api/private', (_req, res) => res.set('Cache-Control', 'no-store').json({private: true}));
  mountStaticClient(app, directory);
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => {
  if (server) {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));}
  if (directory) await rm(directory, {recursive: true, force: true});
});
it.each(['/assets/app-a1B2c3D4.js', '/assets/app-a1B2c3D4.css'])('caches generated hashed asset %s immutably', async file => {
  const result = await fetch(base + file);
  expect(result.status).toBe(200);
  expect(result.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
});
it.each(['/', '/index.html', '/login', '/sw.js', '/assets/app.js', '/icon.svg', '/manifest.webmanifest', '/assets/missing-a1B2c3D4.js'])('requires revalidation for %s instead of stale app caching', async file => {
  const result = await fetch(base + file);
  expect(result.headers.get('cache-control')).toBe('no-cache');
});
it('retains validators so unchanged HTML and worker can return 304', async () => {
  for (const file of ['/index.html', '/sw.js', '/login']) {
    const result = await fetch(base + file);
    const next = await fetch(base + file, {headers: {'If-None-Match': result.headers.get('etag')!, 'Cache-Control': 'max-age=0'}});
    expect(next.status).toBe(304);
    expect(next.headers.get('cache-control')).toBe('no-cache');
  }
});
it('preserves API no-store policy', async () => {
  const result = await fetch(base + '/api/private');
  expect(result.headers.get('cache-control')).toBe('no-store');
});

it.each([['navigate', '/'], ['cors', '/'], ['navigate', '/index.html'], ['cors', '/index.html']])('checks network for HTML (%s %s), falling back to the offline shell only on failure', async (mode, entry) => {
  let worker = '';
  const plugin: any = offlineShellPlugin();
  plugin.generateBundle.call({emitFile: (asset: any) => {worker = asset.source;}}, {}, {});
  const events: Record<string, Function> = {};
  const fresh = {body: 'fresh'}, cached = {body: 'offline'};
  const fetchNetwork = vi.fn().mockResolvedValue(fresh), matchCache = vi.fn().mockResolvedValue(cached);
  vm.runInNewContext(worker, {self:{location:{origin:'https://pos.test'},addEventListener:(type:string, fn:Function)=>{events[type]=fn;}}, URL, fetch:fetchNetwork, caches:{match:matchCache}});
  const request = {method:'GET',url:'https://pos.test'+entry,mode};
  let result: Promise<unknown>;
  events.fetch({request,respondWith:(value:Promise<unknown>)=>{result=value;}});
  expect(await result!).toEqual(fresh); expect(fetchNetwork).toHaveBeenCalled();
  fetchNetwork.mockRejectedValueOnce(new Error('offline'));
  events.fetch({request,respondWith:(value:Promise<unknown>)=>{result=value;}});
  expect(await result!).toEqual(cached);
});
