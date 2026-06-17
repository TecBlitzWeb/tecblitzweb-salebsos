// Self-unregistering service worker — replaces legacy PWA cache worker.
// On activate: wipe all caches, unregister, reload open clients. No fetch/offline handling.

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.map(function(key) { return caches.delete(key); }));
      })
      .then(function() {
        return self.registration.unregister();
      })
      .then(function() {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then(function(clients) {
        clients.forEach(function(client) {
          if (client.url && typeof client.navigate === 'function') {
            client.navigate(client.url);
          }
        });
      })
  );
});
