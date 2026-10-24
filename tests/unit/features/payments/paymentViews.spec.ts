import { describe, it, expect } from 'vitest'
import { PAYMENT_ALERTS, PAYMENT_VIEWS, PAYMENT_COUNTS_OVERLAP_HINT, defaultPaymentViewFor, paymentAlertMeta } from '@/features/payments/lib/paymentViews'
import * as mod from '@/features/payments/lib/paymentViews'

describe('paymentViews', () => {
  it('ordre, libellés et clés de nombre des vues', () => {
    expect(PAYMENT_VIEWS.map(v => [v.id, v.label, v.countKey])).toEqual([
      ['ATTENTION', 'À traiter', 'attention'],
      ['ESCROW', 'En séquestre', 'escrow'],
      ['RELEASED_RECENT', 'Versés (3 j)', 'releasedRecent'],
      ['REFUNDED', 'Remboursés', 'refunded'],
      ['FAILED', 'Échoués / annulés', 'failed'],
      ['ALL', 'Tous', 'all'],
    ])
  })

  it('alertes : libellés, étiquettes courtes et tons', () => {
    expect(PAYMENT_ALERTS.HELD).toEqual({ label: 'Versement retenu', shortLabel: 'Retenu', tone: 'danger' })
    expect(PAYMENT_ALERTS.CHARGEBACK_OPEN).toEqual({ label: 'Litige bancaire ouvert', shortLabel: 'Litige bancaire', tone: 'danger' })
    expect(PAYMENT_ALERTS.MM_FAILED).toEqual({ label: 'Versement échoué', shortLabel: 'Versement échoué', tone: 'danger' })
    expect(PAYMENT_ALERTS.ESCROW_J48).toEqual({ label: 'En séquestre depuis plus de 48 h', shortLabel: 'Séquestre > 48 h', tone: 'warning' })
  })

  it('paymentAlertMeta : inconnu, vide et clés du prototype donnent null', () => {
    expect(paymentAlertMeta('HELD')).toBe(PAYMENT_ALERTS.HELD)
    expect(paymentAlertMeta('NIMPORTE')).toBeNull()
    expect(paymentAlertMeta('toString')).toBeNull()
    expect(paymentAlertMeta(null)).toBeNull()
    expect(paymentAlertMeta(undefined)).toBeNull()
  })

  it('les alertes se recoupent : texte d’aide fourni, aucun helper qui les additionne', () => {
    expect(PAYMENT_COUNTS_OVERLAP_HINT).toBe('Les nombres d’« À traiter » et des alertes se recoupent')
    expect(Object.keys(mod).filter(k => /sum|total|add/i.test(k))).toEqual([])
  })

  it('defaultPaymentViewFor : ATTENTION sans filtre, ALL dès qu’un paramètre de filtre est présent', () => {
    expect(defaultPaymentViewFor({})).toBe('ATTENTION')
    for (const k of ['view', 'alert', 'status', 'method', 'currency', 'dateFrom', 'dateTo', 'hideAbandoned', 'query', 'partyId', 'announcementId', 'bidId', 'amountMin', 'amountMax', 'held']) {
      expect(defaultPaymentViewFor({ [k]: 'x' })).toBe('ALL')
    }
  })

  it('defaultPaymentViewFor : tab, open et section ne sont pas des filtres', () => {
    expect(defaultPaymentViewFor({ tab: 'payments', open: 'abc', section: 'money' })).toBe('ATTENTION')
    expect(defaultPaymentViewFor({ query: '' })).toBe('ATTENTION')
    expect(defaultPaymentViewFor({ query: null })).toBe('ATTENTION')
  })
})
