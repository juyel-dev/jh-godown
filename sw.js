// ============================================================
// JH GODOWN — Service Worker
// PWA support, offline caching, background sync
// ============================================================

const CACHE_NAME = "jh-godown-v3";
const OFFLINE_PAGE = "/jh-godown/index.html";

// Core assets to cache
const CORE_ASSETS = [
  "/jh-godown/",
  "/jh-godown/index.html",
  "/jh-godown/encode.html",
  "/jh-godown/decode.html",
  "/jh-godown/login.html",
  "/jh-godown/profile.html",
  "/jh-godown/post.html",
  "/jh-godown/about.html",
  "/jh-godown/css/app.css",
  "/jh-godown/js/config.js",
  "/jh-godown/js/engine.js",
  "/jh-godown/js/progress.js",
  "/jh-godown/js/api.js",
  "/jh-godown/js/auth.js",
  "/jh-godown/js/image.js",
  "/jh-godown/js/notify.js",
  "/jh-godown/js/share.js",
  "/jh-godown/js/feed.js",
  "/jh-godown/js/encode.js",
  "/jh-godown/js/decode.js",
  "/jh-godown/js/profile.js",
  "/jh-godown/workers/encode.worker.js",
  // CDN assets (cached via network-first, but listed for reference)
];

// ─── Install ───
self.addEventListener("install", (e) => {
  console.log("[SW] Installing...");
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache core pages
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn("[SW] Some assets failed to cache:", err);
      });
    }).then(() => {
      self.skipWaiting();
    })
  );
});

// ─── Activate ───
self.addEventListener("activate", (e) => {
  console.log("[SW] Activating...");
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// ─── Fetch Strategy ───
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Google Apps Script requests (always network)
  if (url.hostname.includes("script.google.com")) {
    return;
  }

  // Skip Telegram API
  if (url.hostname.includes("telegram.org") || url.hostname.includes("api.telegram")) {
    return;
  }

  // CDN assets: stale-while-revalidate
  if (url.hostname.includes("cdnjs") || url.hostname.includes("unpkg") || url.hostname.includes("jsdelivr")) {
    e.respondWith(staleWhileRevalidate(request));
    return;
  }

  // HTML pages: network-first with offline fallback
  if (request.mode === "navigate" || request.destination === "document") {
    e.respondWith(networkFirst(request));
    return;
  }

  // CSS/JS/Worker: cache-first
  if (request.destination === "style" || request.destination === "script" || request.destination === "worker") {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Default: network-first
  e.respondWith(networkFirst(request));
});

// ─── Strategies ───

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    return cached || new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return offline page for navigation
    if (request.mode === "navigate") {
      return cache.match(OFFLINE_PAGE);
    }
    return new Response("Offline — please check your connection", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ─── Background Sync (for offline uploads) ───
self.addEventListener("sync", (e) => {
  if (e.tag === "jh-offline-sync") {
    e.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Placeholder for offline queue sync
  console.log("[SW] Syncing offline queue...");
}

// ─── Push Notifications (future) ───
self.addEventListener("push", (e) => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || "Jh Godown", {
      body: data.body || "New notification",
      icon: "/jh-godown/icon-192.png",
      badge: "/jh-godown/icon-192.png",
      data: data.url || "/jh-godown/",
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.openWindow(e.notification.data || "/jh-godown/")
  );
});

// ─── Message from client ───
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

console.log("[SW] Jh Godown Service Worker loaded");
