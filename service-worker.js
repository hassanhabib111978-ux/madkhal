const CACHE_NAME = "madkhal-v4";

const BASE_URL = new URL("./", self.registration.scope);
const INDEX_URL = new URL("index.html", BASE_URL).href;
const MANIFEST_URL = new URL("manifest.json", BASE_URL).href;

const FILES_TO_CACHE = [
  BASE_URL.href,
  INDEX_URL,
  MANIFEST_URL
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(INDEX_URL, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => {
          return cached || caches.match(INDEX_URL);
        }))
    );

    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
