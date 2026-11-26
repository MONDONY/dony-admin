/* Service worker de l'app admin mobile : notifications push seulement.
   Pas de SDK Firebase, pas de fetch handler, aucune réponse d'API mise en cache. */
importScripts('sw-lib.js')

self.addEventListener('install', function () { self.skipWaiting() })
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()) })

self.addEventListener('push', function (event) {
  var raw = null
  try { raw = event.data ? event.data.json() : null } catch (e) { raw = null }
  var msg = self.YadonySw.parsePush(raw)
  // iOS exige une notification affichée à chaque push.
  event.waitUntil(self.registration.showNotification(msg.title, self.YadonySw.notificationOptions(msg, self.registration.scope)))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var route = event.notification.data && event.notification.data.route
  var scope = self.registration.scope
  var url = self.YadonySw.targetUrl(scope, route)
  event.waitUntil(self.YadonySw.openTarget(self.clients, scope, url))
})
