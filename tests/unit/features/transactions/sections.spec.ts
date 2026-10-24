import { describe, it, expect } from 'vitest'
import { ALL_TABS, SECTIONS, SUB_TABS, TAB_TO_SECTION, defaultTabOfSection, isTab, sectionOf } from '@/features/transactions/lib/sections'

describe('sections', () => {
  it('quatre sections dans l’ordre', () => {
    expect(SECTIONS.map(s => [s.id, s.label])).toEqual([
      ['payments', 'Paiements'], ['mobile-money', 'Mobile money'], ['wallets', 'Soldes'], ['chargebacks', 'Litiges bancaires'],
    ])
  })

  it('les sept ?tab= mappent vers leur section', () => {
    expect(Object.keys(TAB_TO_SECTION).sort()).toEqual(['cash-commissions', 'chargebacks', 'mm-commissions', 'mobile-money', 'payments', 'wallet-refunds', 'wallets'])
    expect(sectionOf('payments')).toBe('payments')
    expect(sectionOf('chargebacks')).toBe('chargebacks')
    expect(sectionOf('mobile-money')).toBe('mobile-money')
    expect(sectionOf('mm-commissions')).toBe('mobile-money')
    expect(sectionOf('wallets')).toBe('wallets')
    expect(sectionOf('wallet-refunds')).toBe('wallets')
    expect(sectionOf('cash-commissions')).toBe('wallets')
    expect(TAB_TO_SECTION['mm-commissions']).toEqual({ section: 'mobile-money', sub: 'mm-commissions' })
  })

  it('sous-onglets des sections à plusieurs listes', () => {
    expect(SUB_TABS['mobile-money']).toEqual([{ id: 'mobile-money', label: 'Opérations' }, { id: 'mm-commissions', label: 'Commissions' }])
    expect(SUB_TABS.wallets).toEqual([
      { id: 'wallets', label: 'Portefeuilles' }, { id: 'wallet-refunds', label: 'Remboursements wallet' }, { id: 'cash-commissions', label: 'Commissions cash' },
    ])
    expect(SUB_TABS.payments).toBeUndefined()
  })

  it('isTab accepte les sept identifiants, rien d’autre', () => {
    for (const t of ALL_TABS) expect(isTab(t.id)).toBe(true)
    expect(isTab('nimporte')).toBe(false)
    expect(isTab('toString')).toBe(false)
    expect(isTab(undefined)).toBe(false)
    expect(isTab(['payments'])).toBe(false)
  })

  it('liste plate de repli : sept onglets', () => {
    expect(ALL_TABS.map(t => t.id)).toEqual(['payments', 'chargebacks', 'mobile-money', 'mm-commissions', 'wallets', 'wallet-refunds', 'cash-commissions'])
  })

  it('onglet par défaut de chaque section', () => {
    expect(SECTIONS.map(s => defaultTabOfSection(s.id))).toEqual(['payments', 'mobile-money', 'wallets', 'chargebacks'])
  })
})
