const CACHE_PREFIX = "madkhal-";
const CACHE_NAME = "madkhal-v27";

// Keep the latest worker active immediately.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

// Only remove caches owned by Madkhal. GitHub Pages shares an origin between
// repositories, so deleting every cache here can break unrelated applications.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Prefer a fresh navigation response, but keep a successful same-origin copy
// for a later network failure. This is a limited navigation fallback, not full
// offline support: API calls and cross-origin scripts still need connectivity.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    new URL(request.url).origin !== self.location.origin
  ) return;

  event.respondWith((async () => {
    try {
      const freshRequest = new Request(request, { cache: "no-store" });
      const response = await fetch(freshRequest);

      if (response.ok && response.type === "basic") {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        } catch (cacheError) {
          // Caching is best-effort and must not block a successful page load.
        }
      }
      return response;
    } catch (networkError) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      throw networkError;
    }
  })());
});
