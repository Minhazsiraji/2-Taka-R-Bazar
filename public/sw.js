const CACHE = '2-taka-r-bazar-shell-v4'
const SHELL = ['/','/login','/manifest.webmanifest','/icon-192.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(fetch(request).then(response => {
    if (response.ok && request.destination !== 'document') {
      const copy = response.clone()
      caches.open(CACHE).then(cache => cache.put(request, copy))
    }
    return response
  }).catch(() => caches.match(request).then(cached => cached || caches.match('/login'))))
})

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text?.() || '' } }
  const title = data.title || '2-TAKA-R-BAZAR'
  const options = {
    body: data.body || 'You have a new update.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.notificationId || undefined,
    renotify: data.priority === 'high',
    data: { href: data.href || '/notifications', notificationId: data.notificationId || null },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const href = event.notification?.data?.href || '/notifications'
  const targetUrl = new URL(href, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined
    })
  )
})
