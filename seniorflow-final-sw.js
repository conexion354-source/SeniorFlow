const CACHE = 'seniorflow-final-v20260327-1';
const APP_SHELL = [
  './seniorflow-final.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './seniorflow-final.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/app-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match('./seniorflow-final.html')));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') return response;
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('./seniorflow-final.html');
          return caches.match('./icons/icon-192.png');
        });
    })
  );
});