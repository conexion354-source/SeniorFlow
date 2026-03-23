
const CACHE_NAME = "mundoled-control-v48";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=48",
  "./app.js?v=48",
  "./firebase-config.js?v=48",
  "./manifest.json?v=48",
  "./icons/icon-192.png?v=48",
  "./icons/icon-512.png?v=48",
  "./img/app-icon.png?v=48",
  "./img/company-logo-wide.png",
  "./img/logo.png"
];
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((response) => {
      if (!response || response.status !== 200 || response.type === "opaque") return response;
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match("./index.html", { ignoreSearch: true }));
  }));
});
