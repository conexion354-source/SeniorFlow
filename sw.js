const CACHE_NAME = 'kflow-v2';
const ASSETS = [
  './',
  './index.html?v=2',
  './app.js?v=2',
  './firebase-config.js',
  './manifest.json?v=2',
  './icons/icon-192.png?v=2',
  './icons/icon-512.png?v=2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((response) => response || fetch(event.request))
  );
});
