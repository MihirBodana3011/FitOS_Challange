const CACHE_NAME = 'fitos-v1';
const ASSETS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Raleway:wght@700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});

// Notification Logic
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: './favicon.ico', // fallback icon
        badge: './favicon.ico',
        vibrate: [200, 100, 200]
      });
    }, delay);
  }
});
