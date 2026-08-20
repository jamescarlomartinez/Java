const CACHE = 'pickleball-v22-complete-player-mixing';
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
    caches.open(CACHE).then(function(cache) {
      return Promise.all(ASSETS.map(function(asset) {
        return fetch(asset, { cache: 'reload' }).then(function(response) {
          if (!response.ok) throw new Error('Could not cache ' + asset);
          return cache.put(asset, response);
        });
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var targetUrl = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
    for (var index = 0; index < windowClients.length; index += 1) {
      var client = windowClients[index];
      if (new URL(client.url).origin === new URL(targetUrl).origin) {
        return client.navigate(targetUrl).then(function(navigated) { return navigated.focus(); });
      }
    }
    return self.clients.openWindow(targetUrl);
  }));
});

self.addEventListener('activate', function(e) {
  var hadOlderPickleballCache = false;
  e.waitUntil(
    caches.keys().then(function(keys) {
      var olderKeys = keys.filter(function(k) { return k.indexOf('pickleball-') === 0 && k !== CACHE; });
      hadOlderPickleballCache = olderKeys.length > 0;
      return Promise.all(
        olderKeys.map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      if (!hadOlderPickleballCache) return null;
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        return Promise.all(clients.filter(function(client) {
          return client.url.indexOf(self.registration.scope) === 0;
        }).map(function(client) { return client.navigate(client.url); }));
      });
    })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  if (url.origin === self.location.origin && url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

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

  if (url.origin !== self.location.origin) return;
  if (/\.(?:js|html|json)$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(function(response) {
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, copy); });
        }
        return response;
      }).catch(function() { return caches.match(e.request); })
    );
    return;
  }
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
