const CACHE_NAME = 'mundo-led-v4';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './firebase-config.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
