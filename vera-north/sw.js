const CACHE="vera-north-v1";
const ASSETS=["./","./index.html","./manifest.webmanifest"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(self.clients.claim());});
self.addEventListener("fetch",e=>{
  const u=e.request.url;
  if(u.includes("esm.run")||u.includes("huggingface")||u.includes("raw.github")) return; // model/library load live
  e.respondWith(caches.match(e.request).then(h=>h||fetch(e.request).catch(()=>caches.match("./index.html"))));
});
