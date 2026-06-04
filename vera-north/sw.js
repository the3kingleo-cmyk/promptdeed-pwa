const CACHE="vera-north-v3";
self.addEventListener("install",e=>{self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>k!==CACHE&&caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=e.request.url;
  if(u.includes("esm.run")||u.includes("huggingface")||u.includes("raw.github")||u.includes("mlc")) return; // model/library: always live
  e.respondWith(
    fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(ch=>ch.put(e.request,c));return r;})
      .catch(()=>caches.match(e.request).then(h=>h||caches.match("./index.html")))
  );
});
