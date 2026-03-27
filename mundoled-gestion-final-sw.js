const CACHE = 'mundoled-gestion-final-20260327-1';
const APP_SHELL = [
  './mundoled-gestion-final.html',
  './mundoled-gestion-final.webmanifest',
  './style.css',
  './firebase-config.js',
  './app-operations-v2.js',
  './mundoled-gestion-final.js',
  './icons/icon-app.svg',
  './img/app-icon.svg'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./mundoled-gestion-final.html');
        return caches.match('./icons/icon-app.svg');
      });
    })
  );
});