// Odubo Main Service Worker - Offline & Poor Connection Support
// Provides comprehensive caching for web hosting on custom domains

const CACHE_VERSION = 'odubo-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const IMAGE_CACHE = 'images-v1';
const API_CACHE = 'api-v1';

// Resources to precache on install (critical for offline/poor connections)
const PRECACHE_URLS = [
  '/',
  '/clips',
  '/media',
  '/store',
  '/site.webmanifest',
];

// Cache strategies
const CACHE_FIRST_PATTERNS = [
  /\.(js|css|woff2?|ttf|eot)$/i,
  /\/_next\/static\//,
  /\/brand-logos\//,
];

const STALE_WHILE_REVALIDATE_PATTERNS = [
  /\/api\/clips/,
  /\/api\/media/,
  /\/api\/videos/,
];

const NETWORK_FIRST_PATTERNS = [
  /\/api\/auth/,
  /\/api\/user/,
  /\/api\/cart/,
];

// Image caching limits
const IMAGE_MAX_ENTRIES = 150;
const IMAGE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// API cache limits
const API_MAX_AGE = 5 * 60 * 1000; // 5 minutes

async function pruneCache(cacheName, maxEntries, maxAge) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    if (requests.length <= maxEntries) return;

    const items = await Promise.all(
      requests.map(async (req) => {
        const res = await cache.match(req);
        const ts = res && res.headers.get('sw-cached-time');
        return { req, ts: ts ? parseInt(ts, 10) : 0 };
      })
    );

    // Remove expired items first
    const now = Date.now();
    const expired = items.filter(i => i.ts && (now - i.ts > maxAge));
    for (const { req } of expired) {
      await cache.delete(req);
    }

    // Then remove oldest if still over limit
    const remaining = await cache.keys();
    if (remaining.length > maxEntries) {
      const sorted = items.filter(i => !expired.includes(i)).sort((a, b) => a.ts - b.ts);
      const toDelete = sorted.slice(0, Math.max(0, remaining.length - maxEntries));
      await Promise.all(toDelete.map(({ req }) => cache.delete(req)));
    }
  } catch (e) {
    console.warn('[SW] Prune error:', e);
  }
}

async function addToCache(cacheName, request, response) {
  if (!response || !response.ok) return response;
  
  const cache = await caches.open(cacheName);
  const headers = new Headers(response.headers);
  headers.set('sw-cached-time', Date.now().toString());
  
  const cachedResponse = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
  
  await cache.put(request, cachedResponse);
  return response;
}

// Install: precache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Precaching critical resources');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'no-cache' })));
      })
      .then(() => {
        console.log('[SW] Precache complete');
      })
      .catch(err => {
        console.warn('[SW] Precache failed:', err);
      })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_VERSION, STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, API_CACHE];
  
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys.map(key => {
            if (!currentCaches.includes(key) && !key.startsWith('hls-')) {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activated and ready');
        return self.clients.claim();
      })
  );
});

// Fetch: smart caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip chrome extensions and other non-http
  if (!url.protocol.startsWith('http')) return;
  
  // Skip HLS content (handled by clips-sw.js)
  if (url.hostname.includes('videodelivery.net') || 
      url.hostname.includes('cloudflarestream.com') ||
      url.pathname.endsWith('.m3u8') ||
      url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.m4s')) {
    return;
  }
  
  // Strategy 1: Images - Cache first with network fallback
  if (request.destination === 'image' || /\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(IMAGE_CACHE)
        .then(cache => cache.match(request))
        .then(cached => {
          if (cached) {
            const cachedTime = cached.headers.get('sw-cached-time');
            if (cachedTime && Date.now() - parseInt(cachedTime, 10) < IMAGE_MAX_AGE) {
              return cached;
            }
          }
          
          return fetch(request)
            .then(response => addToCache(IMAGE_CACHE, request, response))
            .catch(() => cached || new Response('', { status: 408 }));
        })
    );
    event.waitUntil(pruneCache(IMAGE_CACHE, IMAGE_MAX_ENTRIES, IMAGE_MAX_AGE));
    return;
  }
  
  // Strategy 2: Static assets - Cache first
  if (CACHE_FIRST_PATTERNS.some(p => p.test(url.pathname) || p.test(url.href))) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          return fetch(request)
            .then(response => addToCache(STATIC_CACHE, request, response));
        })
    );
    return;
  }
  
  // Strategy 3: API calls - Stale while revalidate for media
  if (STALE_WHILE_REVALIDATE_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(
      caches.open(API_CACHE)
        .then(cache => cache.match(request))
        .then(cached => {
          const fetchPromise = fetch(request)
            .then(response => addToCache(API_CACHE, request, response))
            .catch(() => null);
          
          // Return cached immediately, update in background
          if (cached) {
            const cachedTime = cached.headers.get('sw-cached-time');
            if (cachedTime && Date.now() - parseInt(cachedTime, 10) < API_MAX_AGE) {
              event.waitUntil(fetchPromise);
              return cached;
            }
          }
          
          return fetchPromise.then(fresh => fresh || cached);
        })
    );
    return;
  }
  
  // Strategy 4: Auth/user APIs - Network first
  if (NETWORK_FIRST_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
        .then(response => response || new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }
  
  // Strategy 5: Pages - Network first with offline fallback
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => addToCache(DYNAMIC_CACHE, request, response))
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('/'))
            .then(fallback => fallback || new Response(
              '<html><body style="background:#0a0808;color:#ede8df;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Offline</h1><p>Please check your connection</p></div></body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html' } }
            ));
        })
    );
    return;
  }
  
  // Default: Try network, fall back to cache
  event.respondWith(
    fetch(request)
      .then(response => addToCache(DYNAMIC_CACHE, request, response))
      .catch(() => caches.match(request))
  );
});

// Message handling
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        Promise.all([
          caches.delete(STATIC_CACHE),
          caches.delete(DYNAMIC_CACHE),
          caches.delete(IMAGE_CACHE),
          caches.delete(API_CACHE),
        ]).then(() => {
          console.log('[SW] All caches cleared');
          if (event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        })
      );
      break;
      
    case 'PREFETCH_URLS':
      if (payload?.urls?.length) {
        event.waitUntil(
          caches.open(DYNAMIC_CACHE)
            .then(cache => Promise.all(
              payload.urls.map(url => 
                fetch(url, { priority: 'low' })
                  .then(res => addToCache(DYNAMIC_CACHE, new Request(url), res))
                  .catch(() => null)
              )
            ))
        );
      }
      break;
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncPendingLikes());
  }
});

async function syncPendingLikes() {
  try {
    const cache = await caches.open('pending-actions');
    const requests = await cache.keys();
    
    for (const request of requests) {
      const cached = await cache.match(request);
      if (cached) {
        const data = await cached.json();
        try {
          await fetch(data.url, {
            method: data.method,
            headers: data.headers,
            body: data.body
          });
          await cache.delete(request);
        } catch {
          // Will retry on next sync
        }
      }
    }
  } catch (e) {
    console.warn('[SW] Sync failed:', e);
  }
}

console.log('[SW] Odubo service worker loaded');
