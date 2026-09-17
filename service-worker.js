const CACHE_NAME = "madkhal-v22";

// Stability mode: do not rewrite index.html at delivery time.
// The previous worker modified the live HTML response and could leave the
// mobile browser with a partially rendered / non-responsive page.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(name => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});
