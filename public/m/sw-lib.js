/* Fonctions pures du service worker (testées sous Node via module.exports). */
(function (root) {
  var DEFAULT_TITLE = 'Yadony'

  function str(v) { return typeof v === 'string' ? v : '' }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {} }

  /** Une route d'app commence par un seul « / » : jamais d'URL absolue ni de « //hôte ». */
  function safeRoute(v) {
    return typeof v === 'string' && v.charAt(0) === '/' && v.charAt(1) !== '/' ? v : null
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

  var api = { parsePush: parsePush, targetUrl: targetUrl }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.YadonySw = api
})(typeof self !== 'undefined' ? self : this)
