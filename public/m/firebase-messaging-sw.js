/* Service worker de l'app admin mobile : notifications push seulement.
   Pas de SDK Firebase, pas de fetch handler, aucune réponse d'API mise en cache. */
importScripts('sw-lib.js')

self.addEventListener('install', function () { self.skipWaiting() })
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()) })

self.addEventListener('push', function (event) {
  var raw = null
  try { raw = event.data ? event.data.json() : null } catch (e) { raw = null }
  var msg = self.YadonySw.parsePush(raw)
  var options = {
    body: msg.body,
    data: { route: msg.route },
    icon: self.registration.scope + 'icon-192.png'
  }
  if (msg.tag) options.tag = msg.tag
  // iOS exige une notification affichée à chaque push.
  event.waitUntil(self.registration.showNotification(msg.title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var route = event.notification.data && event.notification.data.route
  var scope = self.registration.scope
  var url = self.YadonySw.targetUrl(scope, route)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i]
        if (c.url.indexOf(scope) === 0 && 'focus' in c) {
          return c.focus().then(function (focused) {
            var client = focused || c
            if ('navigate' in client) return client.navigate(url)
            client.postMessage({ type: 'navigate', url: url })
          })
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
