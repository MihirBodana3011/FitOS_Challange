const CACHE_NAME = "fitos-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Manrope:wght@400;500;600;700;800&family=Raleway:wght@700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap",
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

// Notification Logic - Enhanced
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SCHEDULE_NOTIFICATION") {
    const { title, body, delay } = event.data;
    
    // Schedule notification after delay
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: "./Image/logo-new.png",
        badge: "./Image/logo-new.png",
        tag: "fitos-reminder", // Prevent duplicate notifications
        requireInteraction: false,
        vibrate: [200, 100, 200],
        actions: [
          { action: "open", title: "Open App" },
          { action: "dismiss", title: "Dismiss" }
        ]
      }).catch(err => console.error("Notification failed:", err));
    }, delay);
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  if (event.action === "dismiss") {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});