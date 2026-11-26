import { describe, it, expect, vi } from 'vitest'
// @ts-expect-error fichier JS classique du service worker (module.exports gardé)
import lib from '../../../../public/m/sw-lib.js'

interface Msg { title: string, body: string, route: string | null, tag: string | undefined }
interface FakeClient { url: string, focus?: () => Promise<unknown>, navigate?: (_url: string) => Promise<unknown>, postMessage?: (_m: unknown) => void }
interface ClientsApi { matchAll: (_o: unknown) => Promise<FakeClient[]>, openWindow: (_url: string) => Promise<unknown> }

const { parsePush, targetUrl, notificationOptions, openTarget } = lib as {
  parsePush: (_raw: unknown) => Msg
  targetUrl: (_scope: string, _route: unknown) => string
  notificationOptions: (_msg: Msg, _scope: string) => Record<string, unknown>
  openTarget: (_clients: ClientsApi, _scope: string, _url: string) => Promise<unknown>
}
const SCOPE = 'https://x.test/siragbe/m/'
const URL_ = 'https://x.test/siragbe/m/alertes/abc'

describe('parsePush', () => {
  it('reads the FCM shape { notification, data }', () => {
    expect(parsePush({
      notification: { title: 'Alerte', body: 'Paiement bloqué' },
      data: { type: 'ADMIN_ALERT', route: '/m/alertes/abc' },
    })).toEqual({ title: 'Alerte', body: 'Paiement bloqué', route: '/m/alertes/abc', tag: 'ADMIN_ALERT' })
  })

  it('reads the flat shape { title, body, data }', () => {
    expect(parsePush({ title: 'Ticket', body: 'Nouveau', data: { route: '/m/support/1' } }))
      .toEqual({ title: 'Ticket', body: 'Nouveau', route: '/m/support/1', tag: undefined })
  })

  it.each([null, undefined, 42, 'oops', [], {}, { notification: 5 }, { data: 'x' }, { title: {} }])(
    'never throws and always yields a title for %j', (raw) => {
      const out = parsePush(raw)
      expect(out.title).toBe('Yadony')
      expect(typeof out.body).toBe('string')
      expect(out.route).toBeNull()
    })

  it('accepts a JSON string and ignores non string routes', () => {
    expect(parsePush(JSON.stringify({ title: 'T', data: { route: 12 } })).route).toBeNull()
    expect(parsePush(JSON.stringify({ title: 'T' })).title).toBe('T')
    expect(parsePush('{not json').title).toBe('Yadony')
  })

  it('rejects routes that are not app paths', () => {
    expect(parsePush({ data: { route: 'https://evil.test/' } }).route).toBeNull()
    expect(parsePush({ data: { route: '//evil.test/' } }).route).toBeNull()
  })
})

describe('targetUrl', () => {
  it('builds the three route shapes under the base derived from the scope', () => {
    expect(targetUrl(SCOPE, '/m/alertes/abc')).toBe('https://x.test/siragbe/m/alertes/abc')
    expect(targetUrl(SCOPE, '/m/support/42')).toBe('https://x.test/siragbe/m/support/42')
    expect(targetUrl(SCOPE, '/m/alertes?item=REPORT:0b2f')).toBe('https://x.test/siragbe/m/alertes?item=REPORT:0b2f')
  })

  it('falls back to the scope when the route is missing or invalid', () => {
    expect(targetUrl(SCOPE, null)).toBe(SCOPE)
    expect(targetUrl(SCOPE, undefined)).toBe(SCOPE)
    expect(targetUrl(SCOPE, 'https://evil.test')).toBe(SCOPE)
  })

  it('works with a scope without trailing m/', () => {
    expect(targetUrl('https://x.test/siragbe/', '/m/alertes')).toBe('https://x.test/siragbe/m/alertes')
  })
})

describe('notificationOptions', () => {
  it('a tagged push re-alerts (renotify) instead of silently replacing the previous one', () => {
    const msg = parsePush({ notification: { title: 'Alerte', body: 'x' }, data: { type: 'ADMIN_ALERT', route: '/m/alertes/abc' } })
    expect(notificationOptions(msg, SCOPE)).toEqual({
      body: 'x', data: { route: '/m/alertes/abc' }, icon: `${SCOPE}icon-192.png`, tag: 'ADMIN_ALERT', renotify: true,
    })
  })

  it('without a tag: neither tag nor renotify (renotify without tag is invalid)', () => {
    const opts = notificationOptions(parsePush({ title: 'T', body: 'b' }), SCOPE)
    expect(opts).not.toHaveProperty('tag')
    expect(opts).not.toHaveProperty('renotify')
  })
})

describe('openTarget (notification click)', () => {
  function clientsApi(list: FakeClient[]) {
    return { matchAll: vi.fn(async () => list), openWindow: vi.fn(async () => null) }
  }

  it('focuses the app window and navigates it', async () => {
    const c: FakeClient = { url: `${SCOPE}support`, focus: vi.fn(async () => c), navigate: vi.fn(async () => c), postMessage: vi.fn() }
    const api = clientsApi([c])
    await openTarget(api, SCOPE, URL_)
    expect(c.navigate).toHaveBeenCalledWith(URL_)
    expect(c.postMessage).not.toHaveBeenCalled()
    expect(api.openWindow).not.toHaveBeenCalled()
  })

  it('navigate rejects (window not controlled): posts a navigate message instead', async () => {
    const c: FakeClient = { url: `${SCOPE}support`, focus: vi.fn(async () => c), navigate: vi.fn(async () => { throw new TypeError('not controlled') }), postMessage: vi.fn() }
    const api = clientsApi([c])
    await openTarget(api, SCOPE, URL_)
    expect(c.postMessage).toHaveBeenCalledWith({ type: 'navigate', url: URL_ })
    expect(api.openWindow).not.toHaveBeenCalled()
  })

  it('navigate rejects and postMessage is impossible: opens a window', async () => {
    const c: FakeClient = { url: `${SCOPE}support`, focus: vi.fn(async () => c), navigate: vi.fn(async () => { throw new TypeError('x') }), postMessage: vi.fn(() => { throw new Error('closed') }) }
    const api = clientsApi([c])
    await openTarget(api, SCOPE, URL_)
    expect(api.openWindow).toHaveBeenCalledWith(URL_)
  })

  it('no navigate support: posts the message; neither navigate nor postMessage: opens a window', async () => {
    const a: FakeClient = { url: `${SCOPE}x`, focus: vi.fn(async () => null), postMessage: vi.fn() }
    await openTarget(clientsApi([a]), SCOPE, URL_)
    expect(a.postMessage).toHaveBeenCalledWith({ type: 'navigate', url: URL_ })
    const b: FakeClient = { url: `${SCOPE}x`, focus: vi.fn(async () => b) }
    const api = clientsApi([b])
    await openTarget(api, SCOPE, URL_)
    expect(api.openWindow).toHaveBeenCalledWith(URL_)
  })

  it('focus rejects: still navigates the window it found', async () => {
    const c: FakeClient = { url: `${SCOPE}x`, focus: vi.fn(async () => { throw new Error('no focus') }), navigate: vi.fn(async () => c) }
    await openTarget(clientsApi([c]), SCOPE, URL_)
    expect(c.navigate).toHaveBeenCalledWith(URL_)
  })

  it('no window of the app (desktop tab outside /m/): opens a new one', async () => {
    const desk: FakeClient = { url: 'https://x.test/siragbe/users', focus: vi.fn(), navigate: vi.fn() }
    const api = clientsApi([desk])
    await openTarget(api, SCOPE, URL_)
    expect(desk.navigate).not.toHaveBeenCalled()
    expect(api.openWindow).toHaveBeenCalledWith(URL_)
  })
})
