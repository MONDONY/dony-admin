/**
 * Vues, défauts et options des listes de la section Soldes (portefeuilles, commissions cash,
 * remboursements wallet) et des litiges bancaires.
 */
import { describe, it, expect } from 'vitest'
import {
  CASH_COMMISSION_VIEWS, CASH_COMMISSION_STATUS_OPTIONS, defaultCashCommissionView, isCashCommissionCounts,
} from '@/features/finance/lib/cashCommissionViews'
import {
  CHARGEBACK_VIEWS, chargebackReasonLabel, chargebackOutcomeLabel, defaultChargebackView, isChargebackCounts,
} from '@/features/finance/lib/chargebackViews'
import { WALLET_BALANCE_SIGN_OPTIONS, WALLET_CURRENCY_OPTIONS } from '@/features/finance/lib/walletFilters'
import { defaultWalletRefundView } from '@/features/finance/lib/walletRefundViews'

describe('commissions cash', () => {
  it('deux vues : À traiter (alerte, nombre attention) puis Toutes', () => {
    expect(CASH_COMMISSION_VIEWS.map(v => [v.id, v.label, v.countKey, !!v.alert])).toEqual([
      ['ATTENTION', 'À traiter', 'attention', true], ['ALL', 'Toutes', 'all', false],
    ])
  })
  it('vue par défaut : À traiter s’il y en a, sinon Toutes ; sans nombres : Toutes', () => {
    expect(defaultCashCommissionView({ attention: 2, all: 9 })).toBe('ATTENTION')
    expect(defaultCashCommissionView({ attention: 0, all: 9 })).toBe('ALL')
    expect(defaultCashCommissionView(null)).toBe('ALL')
  })
  it('options de statut : « Tous les statuts » puis les six statuts en clair', () => {
    expect(CASH_COMMISSION_STATUS_OPTIONS.map(o => o.value)).toEqual(['', 'PENDING', 'REQUIRES_3DS', 'CHARGED', 'FAILED', 'REFUNDED', 'REFUND_FAILED'])
    expect(CASH_COMMISSION_STATUS_OPTIONS.find(o => o.value === 'CHARGED')!.label).toBe('Prélevée')
  })
  it('forme des nombres : une page de liste ou un objet partiel ne passe pas', () => {
    expect(isCashCommissionCounts({ attention: 1, all: 2 })).toBe(true)
    expect(isCashCommissionCounts({ attention: 1 })).toBe(false)
    expect(isCashCommissionCounts({ content: [] })).toBe(false)
    expect(isCashCommissionCounts(null)).toBe(false)
  })
})

describe('litiges bancaires', () => {
  it('quatre vues : Ouverts (alerte), Gagnés, Perdus, Tous', () => {
    expect(CHARGEBACK_VIEWS.map(v => [v.id, v.label, v.countKey, !!v.alert])).toEqual([
      ['OPEN', 'Ouverts', 'open', true], ['WON', 'Gagnés', 'won', false], ['LOST', 'Perdus', 'lost', false], ['ALL', 'Tous', 'all', false],
    ])
  })
  it('vue par défaut : Ouverts s’il y en a, sinon Tous', () => {
    expect(defaultChargebackView({ open: 1, won: 0, lost: 0, all: 1 })).toBe('OPEN')
    expect(defaultChargebackView({ open: 0, won: 3, lost: 1, all: 4 })).toBe('ALL')
    expect(defaultChargebackView(null)).toBe('ALL')
  })
  it('forme des nombres', () => {
    expect(isChargebackCounts({ open: 1, won: 0, lost: 0, all: 1 })).toBe(true)
    expect(isChargebackCounts({ open: 1, all: 1 })).toBe(false)
    expect(isChargebackCounts({ content: [] })).toBe(false)
  })
  it('motif Stripe en clair ; inconnu tel quel ; absent : null', () => {
    expect(chargebackReasonLabel('fraudulent')).toBe('Fraude présumée')
    expect(chargebackReasonLabel('product_not_received')).toBe('Colis non reçu')
    expect(chargebackReasonLabel('bank_cannot_process')).toBe('bank_cannot_process')
    expect(chargebackReasonLabel(null)).toBeNull()
  })
  it('issue : seulement quand elle dit autre chose que le statut', () => {
    expect(chargebackOutcomeLabel('WON', 'won')).toBeNull()
    expect(chargebackOutcomeLabel('LOST', 'warning_closed')).toBe('warning_closed')
    expect(chargebackOutcomeLabel('LOST', null)).toBeNull()
    expect(chargebackOutcomeLabel('OPEN', 'needs_response')).toBe('needs_response')
  })
})

describe('portefeuilles', () => {
  it('options de devise et de signe du solde, « toutes » en premier', () => {
    expect(WALLET_CURRENCY_OPTIONS[0]).toEqual({ value: '', label: 'Toutes les devises' })
    expect(WALLET_CURRENCY_OPTIONS.map(o => o.value)).toContain('XOF')
    expect(WALLET_BALANCE_SIGN_OPTIONS.map(o => [o.value, o.label])).toEqual([
      ['', 'Tous les soldes'], ['POSITIVE', 'Solde positif'], ['NEGATIVE', 'Solde négatif'], ['ZERO', 'Solde nul'],
    ])
  })
})

describe('remboursements wallet', () => {
  it('vue par défaut : À traiter quand des tickets attendent, sinon Toutes (inconnu : Toutes)', () => {
    expect(defaultWalletRefundView(2)).toBe('pending')
    expect(defaultWalletRefundView(0)).toBe('all')
    expect(defaultWalletRefundView(null)).toBe('all')
  })
})
