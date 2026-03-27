const CACHE = 'seniorflow-business-v5-20260327-1';
const APP_SHELL = [
  './seniorflow-business-v5.html',
  './seniorflow-business-v5.webmanifest',
  './style.css',
  './firebase-config.js',
  './app-operations-v2.js',
  './admin-tools-v4.js',
  './admin-tools-v5.js',
  './icons/icon-app.svg',
  './img/app-icon.svg',
  './img/mundoled-logo-wide.svg'
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
        if (event.request.mode === 'navigate') return caches.match('./seniorflow-business-v5.html');
        return caches.match('./icons/icon-app.svg');
      });
    })
  );
});