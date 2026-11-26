const CACHE_NAME = "neon-tower-pwa-v79";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=20261126-skins-v1",
  "./skins.css?v=20261126-skins-v1",
  "./engine.js?v=20261126-skins-v1",
  "./level-mode-config.js?v=20261121-desktop-core-upgrades-v1",
  "./entidades.js?v=20261126-skins-v1",
  "./ui.js?v=20261126-skins-v1",
  "./skins.js?v=20261126-skins-v2",
  "./manifest.webmanifest",
  "./neon-tower-icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("neon-tower-pwa-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (!response.ok) return response;
        const copy = response.clone();
        // Keep the response alive until its cache write finishes. A detached
        // cache.put() can be cancelled when the service worker is suspended.
        return caches.open(CACHE_NAME)
          .then(cache => cache.put(request, copy).catch(() => {}))
          .then(() => response);
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then(cached => cached || (request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});