import { describe, it, expect } from 'vitest'
// @ts-expect-error fichier JS classique du service worker (module.exports gardé)
import lib from '../../../../public/m/sw-lib.js'

const { parsePush, targetUrl } = lib as {
  parsePush: (raw: unknown) => { title: string, body: string, route: string | null, tag: string | undefined }
  targetUrl: (scope: string, route: unknown) => string
}
const SCOPE = 'https://x.test/siragbe/m/'

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
