const STOCK_APP_CACHE = 'seniorflow-stock-app-20260711-05';
const STOCK_APP_ASSETS = [
  './stock-app.html',
  './stock-app.js?v=seniorflow-react-20260711-stock-app-05',
  './firebase-config.js?v=seniorflow-react-20260711-stock-app-05',
  './manifest-stock-app.json',
  './icons/stock-app.svg',
  './icons/stock-app-192.png',
  './icons/stock-app-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STOCK_APP_CACHE).then((cache) => cache.addAll(STOCK_APP_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('seniorflow-stock-app-') && key !== STOCK_APP_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate' || url.pathname.endsWith('/stock-app.html')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(STOCK_APP_CACHE);
        cache.put('./stock-app.html', fresh.clone());
        return fresh;
      } catch {
        return caches.match('./stock-app.html');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const fresh = await fetch(event.request);
      const cache = await caches.open(STOCK_APP_CACHE);
      cache.put(event.request, fresh.clone());
      return fresh;
    } catch {
      return caches.match(event.request);
    }
  })());
});
