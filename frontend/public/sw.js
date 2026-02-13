// Minimal service worker for CAprep PWA – cache-first for static assets, network for API
const CACHE_NAME = 'caprep-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Do not cache API or auth requests
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    return;
  }
  // For same-origin GET (HTML, JS, CSS, images), try network first then cache
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
