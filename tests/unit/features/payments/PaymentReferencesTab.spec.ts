/** Onglet Références : identifiants copiables, liens Stripe et mobile money, raccourcis colis et trajet. */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentReferencesTab from '@/features/payments/components/PaymentReferencesTab.vue'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { seedAuth } from '~/tests/helpers/auth'
import { IDS, NuxtLink, fullPayment, insightOf, oldPayment } from '~/tests/helpers/paymentDetail'

const global = { stubs: { NuxtLink } }
const mountTab = (payment: AdminPaymentDetail, copied: string | null = null) =>
  mount(PaymentReferencesTab, { props: { payment, copied }, global })
const hrefOf = (w: ReturnType<typeof mountTab>, test: string) => {
  const el = w.find(`[data-test="${test}"]`)
  expect(el.exists(), test).toBe(true)
  expect(el.element.tagName, test).toBe('A')
  return el.attributes('href')
}

describe('PaymentReferencesTab', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('raccourcis colis et trajet à leur URL exacte', () => {
    const w = mountTab(fullPayment())
    expect(hrefOf(w, 'payment-ref-bid-link')).toBe(`/colis?open=${IDS.BID}`)
    expect(hrefOf(w, 'payment-ref-bid-tracking-link')).toBe(`/colis?open=${IDS.BID}&section=tracking`)
    expect(hrefOf(w, 'payment-ref-bid-incidents-link')).toBe(`/colis?open=${IDS.BID}&section=incidents`)
    expect(hrefOf(w, 'payment-ref-bid-chat-link')).toBe(`/colis?open=${IDS.BID}&section=chat`)
    expect(hrefOf(w, 'payment-trip-link')).toBe(`/colis?tab=announcements&announcement=${IDS.ANN}`)
    expect(hrefOf(w, 'payment-trip-bids-link')).toBe(`/colis?announcementId=${IDS.ANN}`)
    expect(w.find('[data-test="payment-trip-link"]').text()).toBe('Voir le trajet')
    expect(w.find('[data-test="payment-trip-bids-link"]').text()).toBe('Autres colis du même trajet')
  })

  it('fil de négociation : lien vers la demande quand elle est résolue, identifiant copiable', () => {
    const w = mountTab(fullPayment())
    expect(hrefOf(w, 'payment-package-request-link')).toBe(`/colis?tab=demandes&open=${IDS.PR}`)
    expect(w.find('[data-test="payment-thread"]').text()).toContain('thread-1')
    expect(w.find('[data-test="payment-copy-thread"]').exists()).toBe(true)
  })

  it('fil non résolu : identifiant copiable seulement', async () => {
    const w = mountTab(fullPayment({ links: {} }))
    expect(w.find('[data-test="payment-package-request-link"]').exists()).toBe(false)
    await w.find('[data-test="payment-copy-thread"]').trigger('click')
    expect(w.emitted('copy')).toEqual([['thread', 'thread-1']])
  })

  it('« Copier » demande la copie de chaque identifiant', async () => {
    const w = mountTab(fullPayment())
    await w.find('[data-test="payment-copy-id"]').trigger('click')
    await w.find('[data-test="payment-copy-pi"]').trigger('click')
    await w.find('[data-test="payment-copy-charge"]').trigger('click')
    expect(w.emitted('copy')).toEqual([['id', IDS.PAY], ['pi', 'pi_1'], ['charge', 'ch_1']])
    expect(mountTab(fullPayment(), 'pi').find('[data-test="payment-copy-pi"]').text()).toBe('Copié')
  })

  it('Stripe : lien externe sûr, cible d’au moins 40 px', () => {
    const link = mountTab(fullPayment()).find('[data-test="payment-stripe-link"]')
    expect(link.attributes('href')).toBe('https://dashboard.stripe.com/test/payments/pi_1')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.classes()).toContain('min-h-10')
  })

  it('mobile money : identifiants pawaPay copiables et lien vers les opérations (40 px)', async () => {
    const w = mountTab(fullPayment({ method: 'PAWAPAY', stripePaymentIntentId: null, pawapayDepositId: 'dep-1', pawapayPayoutId: 'po-1', pawapayRefundId: 'rf-1', insight: insightOf({ stripeDashboardUrl: null, stripeChargeId: null }) }))
    expect(hrefOf(w, 'payment-mobile-money-link')).toBe('/transactions?tab=mobile-money')
    expect(w.find('[data-test="payment-mobile-money-link"]').classes()).toContain('min-h-10')
    expect(w.find('[data-test="payment-stripe-link"]').exists()).toBe(false)
    await w.find('[data-test="payment-copy-deposit"]').trigger('click')
    await w.find('[data-test="payment-copy-payout"]').trigger('click')
    await w.find('[data-test="payment-copy-refund"]').trigger('click')
    expect(w.emitted('copy')).toEqual([['deposit', 'dep-1'], ['payout', 'po-1'], ['refund', 'rf-1']])
  })

  it('sans BID_VIEW : aucun lien colis, trajet ou demande ; Stripe reste (externe)', () => {
    seedAuth('ADMIN', { BID_VIEW: false })
    const w = mountTab(fullPayment())
    const internal = w.findAll('a').filter(a => a.attributes('href')?.startsWith('/'))
    expect(internal).toHaveLength(0)
    expect(w.find('[data-test="payment-stripe-link"]').exists()).toBe(true)
    expect(w.find('[data-test="payment-thread"]').text()).toContain('thread-1')
  })

  it('sans MODERATION_VIEW : pas d’accès aux échanges du colis, le reste du colis demeure', () => {
    seedAuth('ADMIN', { MODERATION_VIEW: false })
    const w = mountTab(fullPayment())
    expect(w.find('[data-test="payment-ref-bid-chat-link"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-ref-bid-link"]').exists()).toBe(true)
  })

  it('ancien back : seulement les références d’avant, aucun raccourci inventé', () => {
    const w = mountTab(oldPayment({ insight: null }))
    expect(w.find('[data-test="payment-id"]').text()).toContain(IDS.PAY)
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('[data-test="payment-shortcuts"]').exists()).toBe(false)
    expect(w.html()).not.toContain('undefined')
  })
})
