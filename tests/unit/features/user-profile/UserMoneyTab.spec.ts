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
