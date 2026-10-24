import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransactionSectionTabs from '@/features/transactions/components/TransactionSectionTabs.vue'
import type { FinanceCounts } from '@/features/transactions/types'

const counts = (over: Partial<FinanceCounts> = {}): FinanceCounts => ({
  payments: 7, mobileMoney: 3, soldes: 0, chargebacks: 1,
  details: { paymentsAttention: 7, mobileMoneyAttention: 3, walletRefundsPending: 0, cashCommissionsAttention: 0, chargebacksOpen: 1 },
  ...over,
})

function mountTabs(props: Record<string, unknown>) {
  return mount(TransactionSectionTabs, { props: { section: 'payments', sub: 'payments', counts: counts(), ...props } })
}

describe('TransactionSectionTabs', () => {
  it('quatre sections dans l’ordre, pastilles rouges, masquées à 0', () => {
    const w = mountTabs({})
    const ids = w.findAll('[data-test^="section-"]').map(b => b.attributes('data-test'))
    expect(ids).toEqual(['section-payments', 'section-mobile-money', 'section-wallets', 'section-chargebacks'])
    expect(w.find('[data-test="section-payments"]').text()).toContain('Paiements')
    expect(w.find('[data-test="section-wallets"]').text()).toContain('Soldes')
    expect(w.find('[data-test="section-payments"] [data-test="tab-count"]').text()).toBe('7')
    expect(w.find('[data-test="section-payments"] [data-test="tab-count"]').classes()).toContain('text-danger')
    expect(w.find('[data-test="section-mobile-money"] [data-test="tab-count"]').text()).toBe('3')
    expect(w.find('[data-test="section-chargebacks"] [data-test="tab-count"]').text()).toBe('1')
    expect(w.find('[data-test="section-wallets"] [data-test="tab-count"]').exists()).toBe(false)
    expect(w.find('[data-test="section-payments"]').attributes('aria-pressed')).toBe('true')
  })

  it('sections sans sous-onglet : aucune barre secondaire', () => {
    expect(mountTabs({}).find('[data-test^="sub-"]').exists()).toBe(false)
    expect(mountTabs({ section: 'chargebacks', sub: 'chargebacks' }).find('[data-test^="sub-"]').exists()).toBe(false)
  })

  it('Mobile money : Opérations | Commissions, sous-onglet actif', () => {
    const w = mountTabs({ section: 'mobile-money', sub: 'mm-commissions' })
    const subs = w.findAll('[data-test^="sub-"]')
    expect(subs.map(b => b.attributes('data-test'))).toEqual(['sub-mobile-money', 'sub-mm-commissions'])
    expect(subs.map(b => b.text())).toEqual(['Opérations', 'Commissions'])
    expect(w.find('[data-test="sub-mm-commissions"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test="section-mobile-money"]').attributes('aria-pressed')).toBe('true')
  })

  it('Soldes : Portefeuilles | Remboursements wallet | Commissions cash', () => {
    const w = mountTabs({ section: 'wallets', sub: 'wallet-refunds' })
    expect(w.findAll('[data-test^="sub-"]').map(b => b.text())).toEqual(['Portefeuilles', 'Remboursements wallet', 'Commissions cash'])
  })

  it('une section émet l’identifiant historique de son premier onglet', async () => {
    const w = mountTabs({})
    await w.find('[data-test="section-mobile-money"]').trigger('click')
    await w.find('[data-test="section-wallets"]').trigger('click')
    await w.find('[data-test="section-chargebacks"]').trigger('click')
    expect(w.emitted('update:tab')).toEqual([['mobile-money'], ['wallets'], ['chargebacks']])
  })

  it('un sous-onglet émet son identifiant historique', async () => {
    const w = mountTabs({ section: 'wallets', sub: 'wallets' })
    await w.find('[data-test="sub-wallet-refunds"]').trigger('click')
    await w.find('[data-test="sub-cash-commissions"]').trigger('click')
    expect(w.emitted('update:tab')).toEqual([['wallet-refunds'], ['cash-commissions']])
  })

  it('sans nombres (ancien back, pas encore chargés) : les sept onglets plats d’aujourd’hui', async () => {
    const w = mountTabs({ counts: null, section: 'wallets', sub: 'wallet-refunds' })
    expect(w.find('[data-test^="section-"]').exists()).toBe(false)
    const ids = w.findAll('[data-tab-id]').map(b => b.attributes('data-test'))
    expect(ids).toEqual(['tab-payments', 'tab-chargebacks', 'tab-mobile-money', 'tab-mm-commissions', 'tab-wallets', 'tab-wallet-refunds', 'tab-cash-commissions'])
    expect(w.find('[data-test="tab-wallet-refunds"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test="tab-count"]').exists()).toBe(false)
    await w.find('[data-test="tab-mm-commissions"]').trigger('click')
    expect(w.emitted('update:tab')).toEqual([['mm-commissions']])
  })
})
