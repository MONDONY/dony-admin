import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BidMoneyTab from '@/features/bids/components/BidMoneyTab.vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import type { AdminBidDetail } from '@/features/bids/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const Resync = { props: ['paymentId', 'currency'], emits: ['done'], template: '<button data-test="resync-stub" @click="$emit(\'done\')">{{ paymentId }}</button>' }
const stubs = { StripeResyncPanel: Resync }

const legacyBid = {
  id: 'b1', status: 'ACCEPTED', netEur: 40, currency: 'EUR', paymentMethod: 'STRIPE', commissionRate: 0.12,
} as unknown as AdminBidDetail
const fullBid = {
  ...legacyBid,
  trip: { announcementId: 'a' },
  money: {
    paymentId: 'pay-1', rail: 'STRIPE', status: 'ESCROWED', amountCents: 4800, commissionCents: 576, currency: 'EUR',
    refundedCents: 0, capturedAt: '2026-10-07T10:00:00', escrowReleasedAt: null, payoutHeldAt: null, disputed: false,
  },
} as unknown as AdminBidDetail
const mountTab = (bid: AdminBidDetail) => mount(BidMoneyTab, { props: { bid }, global: { stubs } })

describe('BidMoneyTab', () => {
  beforeEach(() => { seedAuth('SUPER_ADMIN') })

  it('moneyTab_keepsAllFieldsAndTestIds', () => {
    const w = mountTab(fullBid)
    expect(w.find('[data-test="section-money"]').exists()).toBe(true)
    expect(w.find('[data-test="money-amount"]').text()).toBe('48,00 EUR')
    expect(w.find('[data-test="money-commission"]').text()).toBe('5,76 EUR')
    expect(w.find('[data-test="bid-detail-net"]').text()).toBe(formatMajorAmount(40, 'EUR'))
    expect(w.find('[data-test="bid-detail-currency"]').text()).toBe('EUR')
    expect(w.find('[data-test="money-method"]').exists()).toBe(true)
    expect(w.find('[data-test="money-status"]').exists()).toBe(true)
    expect(w.find('[data-test="money-captured"]').text()).toContain('Oui, le')
    expect(w.find('[data-test="money-released"]').text()).toContain('Pas encore')
    expect(w.find('[data-test="money-empty"]').exists()).toBe(false)
  })

  it('moneyTab_resyncOnlyForStripeWithPaymentView', async () => {
    const w = mountTab(fullBid)
    expect(w.find('[data-test="action-resync"]').exists()).toBe(true)
    expect(w.find('[data-test="resync-stub"]').text()).toBe('pay-1')
    await w.find('[data-test="resync-stub"]').trigger('click')
    expect(w.emitted('resynced')).toBeTruthy()
    const pawa = { ...fullBid, money: { ...fullBid.money!, rail: 'PAWAPAY' } } as AdminBidDetail
    expect(mountTab(pawa).find('[data-test="action-resync"]').exists()).toBe(false)
    seedAuth('ADMIN', { PAYMENT_VIEW: false })
    expect(mountTab(fullBid).find('[data-test="action-resync"]').exists()).toBe(false)
  })

  it('moneyTab_emptyMessages', () => {
    expect(mountTab({ ...fullBid, money: null, paymentMethod: 'CASH' } as AdminBidDetail).find('[data-test="money-empty"]').text())
      .toBe('Paiement en espèces à la remise : aucun paiement en ligne pour ce colis.')
    expect(mountTab({ ...fullBid, money: null } as AdminBidDetail).find('[data-test="money-empty"]').text())
      .toBe('Aucun paiement en ligne enregistré pour ce colis.')
    expect(mountTab(legacyBid).find('[data-test="money-empty"]').text()).toBe('Détail du paiement non disponible pour l’instant.')
    seedAuth('ADMIN', { PAYMENT_VIEW: false })
    expect(mountTab({ ...fullBid, money: null } as AdminBidDetail).find('[data-test="money-empty"]').text())
      .toBe('Montants du paiement réservés aux admins qui consultent les transactions.')
  })
})
