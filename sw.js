const CACHE_NAME = 'seniorflow-react-20260622-flyer-studio-51';
const ASSETS = [
  './',
  './index.html',
  './app.js?v=seniorflow-react-20260622-flyer-studio-51',
  './firebase-config.js?v=seniorflow-react-20260622-flyer-studio-51',
  './manifest.json',
  './ofertas.html?v=seniorflow-react-20260622-flyer-studio-51',
  './oferta-template-base.jpg',
  './logo-empresa-mundoled.png',
  './logo-ofertas-mundoled-white.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const esShellDinamico = (
    url.pathname.endsWith('/app.js')
    || url.pathname.endsWith('/firebase-config.js')
    || url.pathname.endsWith('/index.html')
    || url.pathname.endsWith('/ofertas.html')
    || url.pathname === '/'
  );

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        cache.put(url.pathname.endsWith('/ofertas.html') ? './ofertas.html?v=seniorflow-react-20260622-flyer-studio-51' : './index.html', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(event.request))
          || (await caches.match(url.pathname.endsWith('/ofertas.html') ? './ofertas.html?v=seniorflow-react-20260622-flyer-studio-51' : './index.html'));
      }
    })());
    return;
  }

  if (esShellDinamico) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch {
      return (await caches.match(event.request))
        || (await caches.match(url.pathname.endsWith('/firebase-config.js')
          ? './firebase-config.js?v=seniorflow-react-20260622-flyer-studio-51'
          : url.pathname.endsWith('/ofertas.html')
            ? './ofertas.html?v=seniorflow-react-20260622-flyer-studio-51'
            : './app.js?v=seniorflow-react-20260622-flyer-studio-51'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, response.clone());
    return response;
  })());
});
