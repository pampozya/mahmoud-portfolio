// Service worker for the pending-work tracker.
// Strategy:
//   - Shell (HTML, manifest, icons): cache-first, refreshed in background
//   - Chart.js CDN: cache-first
//   - api.php: network-only (never cache — must be live)

const VERSION = 'v7';
const SHELL_CACHE = 'pending-shell-' + VERSION;

const SHELL = [
  '/all-pending-tracker.html',
  '/manifest.json',
  '/tracker-icon-192.png',
  '/tracker-icon-512.png',
  '/tracker-icon-512-maskable.png',
  '/tracker-apple-touch.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache the API — needs fresh data and writes.
  if (url.pathname.endsWith('/api.php') || url.pathname.endsWith('api.php')) {
    return; // let the browser handle it normally
  }

  // Cache-first with background refresh for shell + Chart.js.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached); // fall back to cache if offline
      return cached || fetchPromise;
    })
  );
});

// Allow the page to trigger an update.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
