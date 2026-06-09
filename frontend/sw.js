/**
 * Service Worker for Mani's Content Studio PWA
 * v5 — network-first for JS/CSS/HTML so deploys are instant on mobile
 */

const CACHE_NAME = 'content-studio-v5'; // bumped: clears all old caches on devices

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css?v=2.0.0',
  '/app.js?v=2.0.0',
  '/manifest.json',
];

// Install: pre-cache static assets with new cache name
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('[SW] Cache addAll error (non-fatal):', err);
      });
    }).then(() => self.skipWaiting()) // activate immediately without waiting
  );
});

// Activate: delete ALL old caches immediately — this is what clears mobile cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// Fetch strategy:
// - API + images  → always network (never cache)
// - JS / CSS / HTML → network-first (fresh on every deploy, fallback to cache offline)
// - Everything else → cache-first (fast icons, fonts)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always hit network for API and image calls — no caching
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/images/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline — server unreachable' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Network-first for JS, CSS, HTML — ensures latest deploy always loads
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/'
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Save fresh copy to cache for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)) // offline: serve cached version
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
