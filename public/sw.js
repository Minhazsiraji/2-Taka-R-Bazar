const CACHE = '1taka-shell-v1'
const SHELL = ['/','/login','/manifest.webmanifest','/icon-192.png']
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(fetch(request).then(response => {
    if (response.ok && request.destination !== 'document') {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy))
    }
    return response
  }).catch(() => caches.match(request).then(cached => cached || caches.match('/login'))))
})
