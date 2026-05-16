const VERSION = 'v0.3.7';
const CACHE_NAME = `finance-${VERSION}`;
const URLS_TO_CACHE = [
    '/finance/',
    '/finance/index.html',
    '/finance/manifest.json',
    '/finance/sw.js',
    '/finance/api.php',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(URLS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response('Offline: POST/PUT/DELETE not available', { status: 503 });
            })
        );
        return;
    }

    // API requests: network-first with cache fallback
    if (url.pathname.includes('api.php') || url.pathname.includes('/finance/api.php')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, cloned);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        return cached || new Response(
                            JSON.stringify({ error: 'offline', data: { income: [], expenses: {}, payouts: [] } }),
                            { status: 200, headers: { 'Content-Type': 'application/json' } }
                        );
                    });
                })
        );
        return;
    }

    // CDN assets: cache-first (Chart.js, etc)
    if (url.hostname === 'cdnjs.cloudflare.com') {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, cloned);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Shell assets (HTML, CSS, JS): network-first so updates propagate fast
    event.respondWith(
        fetch(request).then((response) => {
            if (!response || response.status !== 200 || response.type === 'error') {
                return caches.match(request).then(c => c || response);
            }
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, cloned);
            });
            return response;
        }).catch(() => {
            return caches.match(request);
        })
    );
});
