const CACHE = 'pickleball-v14-access-and-balance';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './rotation-engine.js',
  './vendor/qrcode.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k)   { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function(response) {
        var copy = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put('./index.html', copy); });
        return response;
      }).catch(function() { return caches.match('./index.html'); })
    );
    return;
  }

  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(function(hit) {
      if (hit) return hit;
      return fetch(e.request).then(function(response) {
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, copy); });
        }
        return response;
      });
    })
  );
});
