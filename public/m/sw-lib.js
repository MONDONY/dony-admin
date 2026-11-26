/* Fonctions pures du service worker (testées sous Node via module.exports). */
(function (root) {
  var DEFAULT_TITLE = 'Yadony'

  function str(v) { return typeof v === 'string' ? v : '' }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {} }

  /**
   * Route de l'app mobile seulement : `/m`, `/m/...` ou `/m?...`. Jamais une page de la console de
   * bureau (hors de l'app installée), ni une URL absolue, `//hôte`, `\`, caractère de contrôle,
   * `//`, `/` ou `\` encodés, ni un segment `.` ou `..` (même encodé) qui sortirait de `/m`.
   * Sinon null : le clic ouvre alors l'accueil de l'app (`/m`).
   */
  function safeRoute(v) {
    if (typeof v !== 'string' || !/^\/m(?:[/?]|$)/.test(v)) return null
    if (/[\\\u0000-\u001f\u007f]/.test(v) || v.indexOf('//') !== -1 || /%2f|%5c/i.test(v)) return null
    var segments = v.split('?')[0].split('/')
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i].replace(/%2e/gi, '.')
      if (s === '.' || s === '..') return null
    }
    return v
  }

  /** Lit un push FCM `{ notification, data }` ou plat `{ title, body, data }`. Ne lève jamais. */
  function parsePush(raw) {
    var payload = raw
    if (typeof raw === 'string') {
      try { payload = JSON.parse(raw) } catch (e) { payload = null }
    }
    var p = obj(payload)
    var n = obj(p.notification)
    var d = obj(p.data)
    return {
      title: str(n.title) || str(p.title) || DEFAULT_TITLE,
      body: str(n.body) || str(p.body),
      route: safeRoute(d.route),
      tag: str(d.type) || undefined
    }
  }

  /** Base du site = scope sans le « m/ » final (scope `<origine>/siragbe/m/`). */
  function targetUrl(scope, route) {
    var r = safeRoute(route)
    if (!r) return scope
    var base = String(scope).replace(/m\/$/, '').replace(/\/$/, '')
    return base + r
  }

  /** Options de la notification. Avec un tag, `renotify` : une 2e alerte du même type sonne aussi. */
  function notificationOptions(msg, scope) {
    var options = { body: msg.body, data: { route: msg.route }, icon: scope + 'icon-192.png' }
    if (msg.tag) {
      options.tag = msg.tag
      options.renotify = true
    }
    return options
  }

  /** Repli quand la fenêtre ne peut pas naviguer : message à la page, sinon nouvelle fenêtre. */
  function viaMessage(clientsApi, client, url) {
    if (client && typeof client.postMessage === 'function') {
      try {
        client.postMessage({ type: 'navigate', url: url })
        return Promise.resolve()
      } catch (e) { /* fenêtre fermée : nouvelle fenêtre */ }
    }
    return clientsApi.openWindow(url)
  }

  /** `navigate` rejette pour une fenêtre que ce service worker ne contrôle pas : repli par message. */
  function navigateClient(clientsApi, client, url) {
    if (client && typeof client.navigate === 'function') {
      return Promise.resolve()
        .then(function () { return client.navigate(url) })
        .catch(function () { return viaMessage(clientsApi, client, url) })
    }
    return viaMessage(clientsApi, client, url)
  }

  /** Clic sur une notification : fenêtre de l'app (sous le scope) mise au premier plan et menée à `url`. */
  function openTarget(clientsApi, scope, url) {
    return clientsApi.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i]
        if (String(c.url).indexOf(scope) === 0 && typeof c.focus === 'function') {
          return Promise.resolve()
            .then(function () { return c.focus() })
            .catch(function () { return null })
            .then(function (focused) { return navigateClient(clientsApi, focused || c, url) })
        }
      }
      return clientsApi.openWindow(url)
    })
  }

  var api = { parsePush: parsePush, targetUrl: targetUrl, notificationOptions: notificationOptions, openTarget: openTarget }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.YadonySw = api
})(typeof self !== 'undefined' ? self : this)
