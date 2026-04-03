const CACHE_NAME = 'fitos-v3';
const ASSETS = [
  './index.html',
  './app.css',
  './app.js',
  './data.json',
  './manifest.json',
  './icons/fitos_icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if(k !== CACHE_NAME) return caches.delete(k);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request).catch(() => {
        if (e.request.url.includes('data.json')) {
          return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } });
        }
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_STRICTION') {
    const d = event.data.payload;
    self.registration.showNotification(d.title || "⚖️ FitOS Strict Alert!", {
      body: d.body || "Check your goals now!",
      icon: './icons/fitos_icon.png',
      vibrate: [300, 100, 300, 100, 300], // Stronger vibration
      tag: d.tag || 'strict-alert',
      renotify: true,
      requireInteraction: true,
      badge: './icons/fitos_icon.png',
      data: { url: './index.html' }
    });
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('./index.html');
    })
  );
});
