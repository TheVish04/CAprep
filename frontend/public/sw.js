// Minimal service worker for CAprep PWA – cache static assets; cache GET /api/questions and /api/resources for offline
const CACHE_NAME = 'caprep-v1';
const API_CACHE_NAME = 'caprep-api-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isCacheableApiRequest(request, url) {
  const path = url.pathname;
  return request.method === 'GET' && (
    path.includes('/api/questions') ||
    path.includes('/api/resources') ||
    path.includes('/api/dashboard') ||
    path.includes('/api/announcements')
  );
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API GET for questions/resources: network-first, cache fallback for offline
  if (isCacheableApiRequest(event.request, url)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok && res.status === 200) {
            const clone = res.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Do not cache other API or cross-origin requests
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    return;
  }
  // Same-origin GET (HTML, JS, CSS, images): network first then cache
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        if (res.ok && res.type === 'basic') {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || fetch(event.request)))
  );
});
