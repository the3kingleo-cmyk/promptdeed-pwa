const CACHE_NAME = 'promptdeed-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((resp) => {
        // Only cache successful, same-origin, non-opaque responses.
        if (resp && resp.ok && resp.type === 'basic') {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((c) => { try { c.put(e.request, respClone); } catch (err) {} });
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
