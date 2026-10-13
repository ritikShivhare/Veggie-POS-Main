import {createHash} from 'node:crypto';
import type {Plugin} from 'vite';
/** Cache app assets only. Customer data, sessions and API responses are excluded. */
export function offlineShellPlugin():Plugin {
  return {name:'aatmyam-offline-shell',apply:'build',generateBundle(_options,bundle){
    const files=['/','/index.html','/manifest.webmanifest','/icon.svg',...Object.keys(bundle).filter(f=>/\.(js|css|svg|woff2?)$/.test(f)).map(f=>'/'+f)];
    const version=createHash('sha256').update(files.join(',')).digest('hex').slice(0,12);
    this.emitFile({type:'asset',fileName:'sw.js',source:`const CACHE='aatmyam-shell-${version}';const ASSETS=${JSON.stringify(files)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('aatmyam-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname==='/ws')return;
if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('/index.html')));return;}
if(ASSETS.includes(u.pathname))e.respondWith(caches.match(r).then(hit=>hit||fetch(r)));});`});
  }};
}
