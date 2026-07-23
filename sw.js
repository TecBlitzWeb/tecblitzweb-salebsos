const CACHE = 'tecblitzweb-sos-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/main.js',
  '/api.js',
  '/local-store.js',
  '/config.js'
];
const NETWORK_TIMEOUT_MS = 4000;
const STATIC_ASSETS = ['/main.js', '/api.js', '/local-store.js', '/config.js'];

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  try {
    const path = new URL(request.url).pathname;
    return path === '/' || path === '/index.html';
  } catch (_e) {
    return false;
  }
}

function isStaticAsset(request) {
  try {
    const path = new URL(request.url).pathname;
    return STATIC_ASSETS.some(function (p) { return path === p || path.endsWith(p); });
  } catch (_e2) {
    return false;
  }
}

function networkWithTimeout(request, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { reject(new Error('network timeout')); }, timeoutMs);
    fetch(request).then(function (res) {
      clearTimeout(timer);
      resolve(res);
    }).catch(function (err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  if (isHtmlRequest(e.request)) {
    e.respondWith(
      networkWithTimeout(e.request, NETWORK_TIMEOUT_MS)
        .then(function (res) { return res; })
        .catch(function () {
          return caches.match(e.request).then(function (cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  if (isStaticAsset(e.request)) {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        var networkFetch = networkWithTimeout(e.request, NETWORK_TIMEOUT_MS)
          .then(function (res) {
            if (res && res.ok) {
              var clone = res.clone();
              caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
            }
            return res;
          });
        return cached || networkFetch;
      })
    );
    return;
  }

  e.respondWith(
    networkWithTimeout(e.request, NETWORK_TIMEOUT_MS)
      .then(function (res) { return res; })
      .catch(function () { return caches.match(e.request); })
  );
});
