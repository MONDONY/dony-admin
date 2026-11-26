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

  it('item_queryValidation', () => {
    expect(parseItemParam(`ADMIN_ALERT:${U}`)).toEqual({ type: 'ADMIN_ALERT', id: U })
    expect(parseItemParam(`DISPUTE_OPENED:${U}`)).toEqual({ type: 'DISPUTE_OPENED', id: U })
    for (const bad of ['../x', 'X:1', `admin:${U}`, `A:${U}/../x`, 'A:' + 'g'.repeat(36), 'A:' + '-'.repeat(36), undefined, ['A:' + U], 42, '']) {
      expect(parseItemParam(bad)).toBeNull()
    }
  })

  it('feedItem_routes', () => {
    expect(feedItemRoute({ id: 'n1', type: 'SUPPORT_MESSAGE_RECEIVED', link: `/support?ticket=${U}` })).toBe(`/m/support/${U}`)
    expect(feedItemRoute({ id: U, type: 'SUPPORT_TICKET_CREATED', link: null })).toBe(`/m/alertes?item=SUPPORT_TICKET_CREATED:${U}`)
    expect(feedItemRoute({ id: 'n1', type: 'SUPPORT_TICKET_CREATED', link: '/support?ticket=../x' })).toBe('/m/alertes')
    expect(feedItemRoute({ id: U, type: 'ADMIN_ALERT', link: null })).toBe(`/m/alertes/${U}`)
    expect(feedItemRoute({ id: 'n', type: 'ADMIN_ALERT', link: `/alertes?open=${U}` })).toBe(`/m/alertes/${U}`)
    expect(feedItemRoute({ id: 'n', type: 'ADMIN_ALERT', link: '/alertes' })).toBe('/m/alertes')
    expect(feedItemRoute({ id: U, type: 'DISPUTE_OPENED', link: '/litiges' })).toBe(`/m/alertes?item=DISPUTE_OPENED:${U}`)
  })
})
