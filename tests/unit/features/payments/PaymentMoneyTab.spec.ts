/** Onglet Argent du tiroir paiement : payé → commission → net → remboursé, dates, lien vers l'argent du colis. */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentMoneyTab from '@/features/payments/components/PaymentMoneyTab.vue'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { seedAuth } from '~/tests/helpers/auth'
import { IDS, NuxtLink, fullPayment, insightOf, oldPayment } from '~/tests/helpers/paymentDetail'

const global = { stubs: { NuxtLink, StripeResyncPanel: { template: '<div data-test="resync-stub" />' } } }
const mountTab = (payment: AdminPaymentDetail) => mount(PaymentMoneyTab, { props: { payment }, global })

describe('PaymentMoneyTab', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('montants dans l’ordre payé → commission → net → remboursé, en chiffres tabulaires', () => {
    const w = mountTab(fullPayment({ refundedCents: 500 }))
    const labels = w.findAll('[data-test="payment-amounts"] dt').map(d => d.text())
    expect(labels.slice(0, 4)).toEqual(['Payé par l’expéditeur', 'Commission Yadony', 'Net voyageur', 'Remboursé'])
    expect(w.find('[data-test="payment-detail-amount"]').text()).toBe('213,00 EUR')
    expect(w.find('[data-test="payment-detail-commission"]').text()).toBe('18,60 EUR')
    expect(w.find('[data-test="payment-detail-net"]').text()).toBe('194,40 EUR')
    expect(w.find('[data-test="payment-detail-refunded"]').text()).toBe('5,00 EUR')
    expect(w.find('[data-test="payment-detail-net"]').classes()).toContain('tabular-nums')
  })

  it('taux de change affiché quand le back le donne, absent sinon', () => {
    expect(mountTab(fullPayment({ insight: insightOf({ fxExchangeRate: 655.957 }) })).find('[data-test="payment-fx-rate"]').text()).toContain('655.957')
    expect(mountTab(fullPayment()).find('[data-test="payment-fx-rate"]').exists()).toBe(false)
  })

  it('encaissement carte et libération datés', () => {
    const w = mountTab(fullPayment({ capturedAt: '2026-10-19T14:05:00', escrowReleasedAt: '2026-10-22T09:00:00' }))
    expect(w.find('[data-test="payment-captured"]').text()).toContain('Encaissé le')
    expect(w.find('[data-test="payment-released-at"]').exists()).toBe(true)
  })

  it('lien « Voir la ventilation côté colis » vers l’onglet Argent du colis (BID_VIEW)', () => {
    const link = mountTab(fullPayment()).find('[data-test="payment-bid-money-link"]')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe(`/colis?open=${IDS.BID}&section=money`)
    expect(link.text()).toBe('Voir la ventilation côté colis')
    expect(link.classes()).toContain('min-h-10')
  })

  it('sans BID_VIEW : aucun <a> dans l’onglet, les montants restent', () => {
    seedAuth('ADMIN', { BID_VIEW: false })
    const w = mountTab(fullPayment())
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('[data-test="payment-detail-amount"]').text()).toBe('213,00 EUR')
  })

  it('négociation sans colis ou ancien back sans contexte : pas de lien, jamais « undefined »', () => {
    const neg = mountTab(fullPayment({ insight: insightOf({ kind: 'NEGOTIATION', bidId: null }) }))
    expect(neg.find('a').exists()).toBe(false)
    const old = mountTab(oldPayment({ insight: null }))
    expect(old.find('a').exists()).toBe(false)
    expect(old.find('[data-test="payment-detail-net"]').text()).toBe('194,40 EUR')
    expect(old.html()).not.toContain('undefined')
  })

  it('resynchronisation Stripe : seulement pour une carte avec PaymentIntent', () => {
    expect(mountTab(fullPayment()).find('[data-test="payment-resync"]').exists()).toBe(true)
    expect(mountTab(fullPayment({ stripePaymentIntentId: null })).find('[data-test="payment-resync"]').exists()).toBe(false)
    expect(mountTab(fullPayment({ method: 'PAWAPAY' })).find('[data-test="payment-resync"]').exists()).toBe(false)
  })
})
