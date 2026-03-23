const CACHE_NAME = "mundo-led-control-v44";
const STATIC_ASSETS = [
  "./",
  "./index.html?v=44",
  "./style.css?v=44",
  "./app.js?v=44",
  "./firebase-config.js?v=44",
  "./manifest.json?v=44",
  "./icons/icon-192.png?v=44",
  "./icons/icon-512.png?v=44",
  "./apple-touch-icon.png?v=44",
  "./favicon-32.png?v=44",
  "./img/app-icon.png?v=44",
  "./img/company-logo-wide.png?v=44"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isDynamic =
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/style.css") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/firebase-config.js") ||
    url.pathname.endsWith("/manifest.json") ||
    url.search.includes("v=");

  if (isDynamic) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request) || caches.match("./index.html?v=44")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("./index.html?v=44"));
    })
  );
});
