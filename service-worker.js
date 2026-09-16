const CACHE_NAME = "madkhal-v19";

const BASE_URL = new URL("./", self.registration.scope);
const INDEX_URL = new URL("index.html", BASE_URL).href;
const MANIFEST_URL = new URL("manifest.json", BASE_URL).href;
const ICON_192_URL = new URL("icon-192.png", BASE_URL).href;
const ICON_512_URL = new URL("icon-512.svg", BASE_URL).href;
const WORKER_SAVE_MESSAGE_URL = new URL("madkhal-worker-save-message.js", BASE_URL).href;
const OCCUPATION_CONNECTION_FIX_URL = new URL("madkhal-occupation-connection-fix.js", BASE_URL).href;

const FILES_TO_CACHE = [BASE_URL.href, INDEX_URL, MANIFEST_URL, ICON_192_URL, ICON_512_URL, WORKER_SAVE_MESSAGE_URL, OCCUPATION_CONNECTION_FIX_URL];

function cleanIndex(html) {
  return html
    .replace(/\s*<script>\s*\/\* MADKHAL_NAVIGATION_FIX_V1 \*\/[\s\S]*?<\/script>\s*/i, "\n")
    .replace(/\s*<\/body>/i, '\n<script src="./madkhal-occupation-connection-fix.js" defer></script>\n<script src="./madkhal-worker-save-message.js" defer></script>\n</body>');
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(async response => {
          if (!response || !response.ok) return caches.match(INDEX_URL);
          const type = response.headers.get("content-type") || "";
          if (!type.includes("text/html")) return response;
          const html = cleanIndex(await response.text());
          return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
