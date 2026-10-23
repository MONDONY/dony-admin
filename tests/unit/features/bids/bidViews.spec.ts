import { describe, it, expect } from 'vitest'
import { BID_ALERTS, BID_VIEWS, alertMeta, defaultViewFor, isBidView } from '@/features/bids/lib/bidViews'

describe('bidViews', () => {
  it('ordre et libellés des vues', () => {
    expect(BID_VIEWS.map(v => [v.id, v.label, v.countKey])).toEqual([
      ['TODO', 'À traiter', 'todo'],
      ['ACTIVE', 'En cours', 'active'],
      ['RECENT', 'Livrés depuis 3 jours', 'recent'],
      ['COMPLETED', 'Terminés', 'completed'],
      ['CLOSED', 'Annulés / refusés', 'closed'],
      ['ALL', 'Tous', 'all'],
    ])
  })

  it('isBidView', () => {
    expect(isBidView('TODO')).toBe(true)
    expect(isBidView('ALL')).toBe(true)
    expect(isBidView('todo')).toBe(false)
    expect(isBidView(undefined)).toBe(false)
    expect(isBidView(3)).toBe(false)
  })

  it('alertes : libellés et tons', () => {
    expect(BID_ALERTS.DISPUTE_OPEN).toMatchObject({ label: 'Litige ouvert', tone: 'danger' })
    expect(BID_ALERTS.NO_SHOW).toMatchObject({ label: 'No-show', tone: 'danger' })
    expect(BID_ALERTS.PAYMENT_PENDING).toMatchObject({ label: 'Paiement en attente', tone: 'warning' })
    expect(BID_ALERTS.LATE).toMatchObject({ label: 'En retard', tone: 'warning' })
    expect(alertMeta('LATE')).toBe(BID_ALERTS.LATE)
  })

  it('alertMeta_unknown_null', () => {
    expect(alertMeta('WHATEVER')).toBeNull()
    expect(alertMeta(null)).toBeNull()
    expect(alertMeta(undefined)).toBeNull()
    expect(alertMeta('toString')).toBeNull()
  })

  it('defaultViewFor_empty_TODO', () => {
    expect(defaultViewFor({})).toBe('TODO')
  })

  it('defaultViewFor_announcementId_ALL', () => {
    expect(defaultViewFor({ announcementId: 'x' })).toBe('ALL')
  })

  it('defaultViewFor_status_ALL', () => {
    expect(defaultViewFor({ status: 'CANCELLED' })).toBe('ALL')
    for (const k of ['view', 'query', 'dateFrom', 'dateTo', 'paymentMethod', 'content', 'alert', 'scope']) {
      expect(defaultViewFor({ [k]: 'v' })).toBe('ALL')
    }
  })

  it('defaultViewFor_ignoresTabAndOpen', () => {
    expect(defaultViewFor({ open: 'abc' })).toBe('TODO')
    expect(defaultViewFor({ tab: 'announcements', open: 'abc' })).toBe('TODO')
  })
})
