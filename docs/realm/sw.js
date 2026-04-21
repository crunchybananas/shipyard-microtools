// Loop 049 (silent-module): dev-only service worker that forces
// `cache: 'no-store'` for all `/js/*.js` fetches. Chrome's ES-module
// cache was holding stale imports across hard-reloads, costing ~40min
// total across ticks 044/045/047/048. Registered ONLY on localhost by
// the bootstrap in index.html so public deploys see normal caching.

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.includes('/js/') && url.pathname.endsWith('.js')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
  }
});
