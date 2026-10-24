import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import UserMoneyTab from '@/features/user-profile/components/UserMoneyTab.vue'

const sectionMock = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: { section: (...a: unknown[]) => sectionMock(...a) },
}))
const WalletStub = { props: ['userId'], template: '<div data-test="wallet-stub">{{ userId }}</div>' }
const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, UserWalletTab: WalletStub }

describe('UserMoneyTab', () => {
  beforeEach(() => {
    sectionMock.mockReset()
    seedAuth('ADMIN')
  })

  it('portefeuille puis paiements ; montant XOF via formatAmount ; lien vers la transaction', async () => {
    sectionMock.mockResolvedValue({
      content: [{ id: 'p1', bidId: 'b1', status: 'RELEASED', method: 'STRIPE', amountCents: 600000, commissionCents: 72000, currency: 'XOF', createdAt: '2026-10-20T10:00:00Z', payoutHeldAt: null, beneficiaryHeld: false, role: 'BENEFICIARY' }],
      totalPages: 1, number: 0, totalElements: 1,
    })
    const w = mount(UserMoneyTab, { props: { userId: 'u1' }, global: { stubs } })
    await flushPromises()
    expect(w.get('[data-test="wallet-stub"]').text()).toBe('u1')
    expect(sectionMock).toHaveBeenCalledWith('u1', 'payments', 0, 20, undefined)
    const row = w.get('[data-test="section-row"]')
    expect(row.text()).toContain('6 000,00 XOF')
    expect(row.text()).toContain('Bénéficiaire')
    expect(row.get('a').attributes('href')).toBe('/transactions?open=p1')
    const html = w.html()
    expect(html.indexOf('wallet-stub')).toBeLessThan(html.indexOf('section-payments'))
  })
})

describe('UserMoneyTab : liens vers Transactions', () => {
  const U = '0a1b2c3d-1111-4222-8333-444455556666'
  beforeEach(() => { sectionMock.mockReset().mockResolvedValue({ content: [], totalPages: 0, number: 0, totalElements: 0 }) })

  it('avec PAYMENT_VIEW : « Tous ses paiements » et « Son portefeuille »', async () => {
    seedAuth('ADMIN')
    const w = mount(UserMoneyTab, { props: { userId: U }, global: { stubs } })
    await flushPromises()
    const all = w.get('[data-test="user-payments-all-link"]')
    expect(all.element.tagName).toBe('A')
    expect(all.attributes('href')).toBe(`/transactions?partyId=${U}`)
    expect(all.text()).toBe('Tous ses paiements')
    const wallet = w.get('[data-test="user-wallet-link"]')
    expect(wallet.attributes('href')).toBe(`/transactions?tab=wallets&partyId=${U}`)
    expect(wallet.text()).toBe('Son portefeuille')
  })

  it('sans PAYMENT_VIEW, ou identifiant mal formé : aucun lien', async () => {
    seedAuth('ADMIN', { PAYMENT_VIEW: false })
    const w = mount(UserMoneyTab, { props: { userId: U }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="user-payments-all-link"]').exists()).toBe(false)
    expect(w.find('[data-test="user-wallet-link"]').exists()).toBe(false)
    seedAuth('ADMIN')
    const w2 = mount(UserMoneyTab, { props: { userId: 'u1' }, global: { stubs } })
    await flushPromises()
    expect(w2.find('[data-test="user-payments-all-link"]').exists()).toBe(false)
  })
})
