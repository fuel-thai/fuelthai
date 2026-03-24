const CACHE_NAME = 'fuel-th-v5';
const API_CACHE = 'fuel-th-api-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API requests: network-first, cache fallback for offline
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/cron/')) return;

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || new Response(JSON.stringify({ error: 'offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        )
    );
    return;
  }

  // Static assets (JS/CSS/images): let the browser + CF edge handle caching
  // Vite uses content-hashed filenames so new deploys = new URLs = no stale cache
  if (url.pathname.match(/\.(js|css|png|svg|woff2?|ico)$/)) return;

  // HTML navigation: network-first, cache shell for offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match('/').then((cached) => cached || caches.match(event.request)))
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'FUEL::TH', body: 'Diesel status update', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'fuel-th',
      renotify: !!data.renotify,
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click -- open the URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('fuel.lanta.dev') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
