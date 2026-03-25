const CACHE_NAME = "fitos-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Raleway:wght@700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap",
];

// Install Event
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll, ignoring failures for external assets
      return cache
        .addAll(ASSETS)
        .catch((err) => console.error("Cache addAll failed:", err));
    }),
  );
});

// Activate Event - Clean up old caches immediately
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Fetch Event - Network First with Cache Fallback
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Valid response - clone and update cache
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed - fallback to cache
        return caches.match(e.request);
      }),
  );
});

// Notification Logic
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SCHEDULE_NOTIFICATION") {
    const { title, body, delay } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: "./Image/logo-192.svg",
        badge: "./Image/logo-192.svg",
        vibrate: [200, 100, 200],
      });
    }, delay);
  }
});
