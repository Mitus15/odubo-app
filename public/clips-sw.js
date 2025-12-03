// Clips Feed Service Worker - HLS Manifest Caching
// Enables instant playback on repeat views by caching manifests

const CACHE_VERSION = 'clips-v1';
const HLS_MANIFEST_CACHE = 'hls-manifests-v1';
const SEGMENT_CACHE = 'hls-segments-v1';

// Cache duration: 5 minutes for manifests, 30 minutes for segments
const MANIFEST_MAX_AGE = 5 * 60 * 1000;
const SEGMENT_MAX_AGE = 30 * 60 * 1000;

// Install event - setup caches
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(HLS_MANIFEST_CACHE).then(() => {
      console.log('[SW] Caches initialized');
      self.skipWaiting(); // Activate immediately
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== HLS_MANIFEST_CACHE && key !== SEGMENT_CACHE && key !== CACHE_VERSION) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activated');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event - smart caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only handle HLS content from videodelivery.net (Cloudflare Stream)
  if (!url.hostname.includes('videodelivery.net')) {
    return; // Let browser handle normally
  }
  
  // Strategy 1: Cache HLS manifests (.m3u8 files)
  if (url.pathname.endsWith('.m3u8')) {
    event.respondWith(
      caches.open(HLS_MANIFEST_CACHE).then(cache =>
        cache.match(event.request).then(cachedResponse => {
          // Check if cached response is still fresh
          if (cachedResponse) {
            const cachedTime = cachedResponse.headers.get('sw-cached-time');
            if (cachedTime && Date.now() - parseInt(cachedTime, 10) < MANIFEST_MAX_AGE) {
              console.log('[SW] Serving cached manifest:', url.pathname);
              return cachedResponse;
            }
          }
          
          // Fetch fresh manifest
          return fetch(event.request).then(response => {
            // Only cache successful responses
            if (response.ok) {
              // Clone and add cache timestamp
              const responseToCache = response.clone();
              const headers = new Headers(responseToCache.headers);
              headers.set('sw-cached-time', Date.now().toString());
              
              const cachedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
              });
              
              cache.put(event.request, cachedResponse);
              console.log('[SW] Cached manifest:', url.pathname);
            }
            return response;
          }).catch(() => {
            // Network failed, return stale cache if available
            return cachedResponse || new Response('Network error', { status: 408 });
          });
        })
      )
    );
    return;
  }
  
  // Strategy 2: Cache video segments (.ts, .m4s files) - more aggressive
  if (url.pathname.endsWith('.ts') || url.pathname.endsWith('.m4s')) {
    event.respondWith(
      caches.open(SEGMENT_CACHE).then(cache =>
        cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            const cachedTime = cachedResponse.headers.get('sw-cached-time');
            if (cachedTime && Date.now() - parseInt(cachedTime, 10) < SEGMENT_MAX_AGE) {
              console.log('[SW] Serving cached segment');
              return cachedResponse;
            }
          }
          
          // Fetch with low priority
          return fetch(event.request).then(response => {
            if (response.ok) {
              const responseToCache = response.clone();
              const headers = new Headers(responseToCache.headers);
              headers.set('sw-cached-time', Date.now().toString());
              
              const cachedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
              });
              
              cache.put(event.request, cachedResponse);
            }
            return response;
          }).catch(() => {
            return cachedResponse || new Response('Network error', { status: 408 });
          });
        })
      )
    );
    return;
  }
});

// Message event - allow cache clearing from app
self.addEventListener('message', (event) => {
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(HLS_MANIFEST_CACHE),
        caches.delete(SEGMENT_CACHE)
      ]).then(() => {
        console.log('[SW] Cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
