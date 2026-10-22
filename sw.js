/* Offline support: the app shell answers from cache at once and refreshes in the background,
   so the trip still opens with no signal in China. Fonts are kept the first time they load. */
const VERSION = "sht-2026-10-23l";
const FONTS = "sht-fonts";
const CORE = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./data.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function cacheFirst(e, name, max) {
  e.respondWith(
    caches.open(name).then(async (cache) => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      try {
        const res = await fetch(e.request);
        if (res && (res.ok || res.type === "opaque")) {
          cache.put(e.request, res.clone());
          if (max) e.waitUntil(trim(cache, max));
        }
        return res;
      } catch (err) {
        return Response.error();
      }
    })
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
        const fresh = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => null);
        if (hit) { e.waitUntil(fresh); return hit; }
        const res = await fresh;
        if (res) return res;
        if (req.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
        return Response.error();
      })
    );
    return;
  }

  /* other sites (photos, the shared-trip server) go straight to the network */
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") cacheFirst(e, FONTS, 0);
});
