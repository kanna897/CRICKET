importScripts("/push-handler.js");

const VERSION = "crickpulse-v3";
const STATIC_CACHE = `${VERSION}-static`;
const PUBLIC_CACHE = `${VERSION}-public`;
const OFFLINE_URL = "/en/offline";
const PRECACHE = [
  "/en",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/brand/crickpulse-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![STATIC_CACHE, PUBLIC_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "SHOW_MATCH_NOTIFICATION") {
    const payload = event.data.payload || {};
    event.waitUntil(self.registration.showNotification(payload.title || "CrickPulse Live", {
      body: payload.body || "A live match update is available.",
      icon: "/brand/crickpulse-logo.png",
      badge: "/brand/crickpulse-logo.png",
      data: { url: payload.url || "/en/fixtures" },
      tag: payload.tag || "crickpulse-live-match",
      renotify: true
    }));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never persist authenticated/admin/API traffic in Cache Storage.
  if (url.pathname.includes("/admin") || url.pathname.startsWith("/api/") || url.pathname.includes("/auth/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(PUBLIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)))
    );
    return;
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const refreshed = fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || refreshed;
      })
    );
  }
});
