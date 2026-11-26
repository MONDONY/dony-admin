import { describe, it, expect } from 'vitest'
import { sortAlerts, parseItemParam, feedItemRoute, ALERT_CHIPS } from '@/features/mobile/lib/mobileAlerts'
import type { AdminAlert } from '@/features/alerts/types/index'

const U = '3f2a9c1e-1111-4222-8333-444455556666'
const alert = (id: string, severity: AdminAlert['severity'], createdAt: string): AdminAlert => ({
  id, type: 'PAYOUT_HELD_x', severity, payload: {}, resolved: false, resolvedAt: null, createdAt,
})

describe('mobileAlerts lib', () => {
  it('list_sortsBySeverityThenDate', () => {
    const out = sortAlerts([
      alert('info-new', 'INFO', '2026-11-26T10:00:00'),
      alert('warn-old', 'WARN', '2026-11-20T10:00:00'),
      alert('crit-old', 'CRITICAL', '2026-11-01T10:00:00'),
      alert('crit-new', 'CRITICAL', '2026-11-25T10:00:00'),
      alert('warn-new', 'WARN', '2026-11-24T10:00:00'),
      alert('bad-date', 'INFO', 'nope'),
    ])
    expect(out.map(a => a.id)).toEqual(['crit-new', 'crit-old', 'warn-new', 'warn-old', 'info-new', 'bad-date'])
  })

  it('maps the three chips to the API filters', () => {
    expect(ALERT_CHIPS.map(c => [c.label, c.key])).toEqual([['À traiter', 'OPEN'], ['En attente', 'SNOOZED'], ['Traitées', 'RESOLVED']])
  })

  it('item_queryValidation: the composite feed id stays whole and opaque (hex in either case)', () => {
    expect(parseItemParam(`ADMIN_ALERT:${U}`)).toBe(`ADMIN_ALERT:${U}`)
    expect(parseItemParam(`DISPUTE_OPENED:${U}`)).toBe(`DISPUTE_OPENED:${U}`)
    expect(parseItemParam(`SUPPORT_MESSAGE_RECEIVED:${U.toUpperCase()}`)).toBe(`SUPPORT_MESSAGE_RECEIVED:${U.toUpperCase()}`)
    for (const bad of [
      '../x', 'X:1', U, `admin:${U}`, `A:${U}/../x`, `TYPE:TYPE:${U}`, 'A:' + 'g'.repeat(36), 'A:' + '-'.repeat(36),
      undefined, ['A:' + U], 42, '',
    ]) {
      expect(parseItemParam(bad)).toBeNull()
    }
  })

  // Contrat réel du back : ids composites `<TYPE>:<uuid>`, lien d'alerte `/alertes` sans `?open=`,
  // lien de support `/support?ticket=<uuid>`.
  it('feedItem_routes on the real feed contract', () => {
    const T = '9b8c7d6e-2222-4333-8444-555566667777'
    expect(feedItemRoute({ id: `ADMIN_ALERT:${U}`, type: 'ADMIN_ALERT', link: '/alertes' })).toBe(`/m/alertes/${U}`)
    expect(feedItemRoute({ id: 'ADMIN_ALERT:nope', type: 'ADMIN_ALERT', link: '/alertes' })).toBe('/m/alertes')
    expect(feedItemRoute({ id: `SUPPORT_MESSAGE_RECEIVED:${U}`, type: 'SUPPORT_MESSAGE_RECEIVED', link: `/support?ticket=${T}` })).toBe(`/m/support/${T}`)
    expect(feedItemRoute({ id: `SUPPORT_TICKET_CREATED:${T}`, type: 'SUPPORT_TICKET_CREATED', link: `/support?ticket=${T}` })).toBe(`/m/support/${T}`)
    // Lien de support illisible : la fiche courte, jamais un segment tiré du lien.
    expect(feedItemRoute({ id: `SUPPORT_TICKET_CREATED:${T}`, type: 'SUPPORT_TICKET_CREATED', link: '/support?ticket=../x' }))
      .toBe(`/m/alertes?item=SUPPORT_TICKET_CREATED:${T}`)
    expect(feedItemRoute({ id: `DISPUTE_OPENED:${U}`, type: 'DISPUTE_OPENED', link: '/litiges' })).toBe(`/m/alertes?item=DISPUTE_OPENED:${U}`)
    expect(feedItemRoute({ id: 'n1', type: 'DISPUTE_OPENED', link: null })).toBe('/m/alertes')
  })

  it('the route built from a feed item is the one the push sends, and it parses back to the same id', () => {
    const id = `KYC_IN_REVIEW:${U}`
    const route = feedItemRoute({ id, type: 'KYC_IN_REVIEW', link: '/kyc' })
    expect(route).toBe(`/m/alertes?item=${id}`)
    expect(parseItemParam(new URLSearchParams(route.split('?')[1]).get('item'))).toBe(id)
  })
})
