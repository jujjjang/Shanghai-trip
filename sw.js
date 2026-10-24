/* Offline support: the app shell answers from cache at once and refreshes in the background,
   so the trip still opens with no signal in China. Fonts are kept the first time they load. */
const VERSION = "sht-2026-10-25zd";
const FONTS = "sht-fonts";
const IMGS = "sht-imgs"; /* place pictures from the internet: kept on the phone so they show at once (and in China, where Wikimedia is blocked) */
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
  /* cache: "reload" — straight from the server, not the browser's own short-term copy (or a new version would install old files) */
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS && k !== IMGS).map((k) => caches.delete(k))))
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
        const ask = req.mode === "navigate" ? new Request(req.url, { cache: "no-cache", credentials: "same-origin" }) : new Request(req, { cache: "no-cache" });
        const fresh = fetch(ask).then((res) => {
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

  /* other sites: fonts and internet pictures are kept; the shared-trip server (and its photos, kept in IndexedDB) go straight to the network */
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") cacheFirst(e, FONTS, 0);
  else if (req.destination === "image" && !/supabase\.co$/.test(url.hostname)) cacheFirst(e, IMGS, 200);
});
