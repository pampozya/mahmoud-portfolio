const VERSION = 'v0.5.9';
const CACHE_NAME = `finance-${VERSION}`;
const URLS_TO_CACHE = [
    '/finance/',
    '/finance/index.html',
    '/finance/manifest.json',
    '/finance/sw.js',
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

    // API requests stay network-only so stale cached JSON cannot replace edits.
    if (url.pathname.includes('api.php') || url.pathname.includes('/finance/api.php')) {
        event.respondWith(
            fetch(request).catch(() => new Response(
                JSON.stringify({ error: 'offline' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
            ))
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

self.addEventListener('push', (event) => {
    let data = { title: 'Finance Alert', body: '', url: '/finance/' };
    try { data = { ...data, ...event.data.json() }; } catch {}
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/finance/icon-192.png',
            badge: '/finance/icon-192.png',
            tag: 'finance-alert',
            renotify: true,
            data: { url: data.url }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = event.notification.data?.url || '/finance/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const existing = clientList.find(c => c.url.includes('/finance'));
            if (existing) return existing.focus();
            return self.clients.openWindow(target);
        })
    );
});

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
