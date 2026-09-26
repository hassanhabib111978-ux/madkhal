const CACHE_NAME = "madkhal-v24";

// Keep the latest page active immediately.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

// Remove any previous Madkhal caches and take control immediately.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(name => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});

// GitHub Pages / mobile browsers may retain an older index.html in the
// browser HTTP cache. For page navigations, always request a fresh copy.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;

  event.respondWith((async () => {
    try {
      const freshRequest = new Request(event.request, { cache: "no-store" });
      return await fetch(freshRequest);
    } catch (error) {
      // Network failure: fall back to the current browser response when possible.
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
