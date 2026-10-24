/** Bandeau « ce qui bloque » du tiroir paiement. */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentAlertBanner from '@/features/payments/components/PaymentAlertBanner.vue'
import { paymentActions } from '@/features/payments/lib/paymentActions'
import type { AdminPaymentDetail, PaymentInsight } from '@/features/payments/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="JSON.stringify(to)"><slot /></a>' }
const CB = 'cccccccc-1111-4111-8111-111111111111'
const pay = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
  id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 100, currency: 'EUR',
  createdAt: '2026-10-19T14:02:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false, ...over,
})
const held = (over: Partial<AdminPaymentDetail> = {}) => pay({ payoutHeldAt: '2026-10-19T10:00:00Z', beneficiaryHeld: true, beneficiaryHoldReason: 'BANNED', travelerId: 't1', ...over })
function mountBanner(payment: AdminPaymentDetail, can = () => true) {
  const isHeld = payment.beneficiaryHeld === true || payment.payoutHeldAt != null
  return mount(PaymentAlertBanner, { props: { payment, actions: paymentActions(payment, can, isHeld) }, global: { stubs: { NuxtLink } } })
}

describe('PaymentAlertBanner', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('sans alerte : pas de bandeau', () => {
    expect(mountBanner(pay({ alert: null })).find('[data-test="payment-alert-banner"]').exists()).toBe(false)
    expect(mountBanner(pay()).html()).not.toContain('data-test')
  })

  it('paiement retenu : rouge, « À traiter : versement retenu depuis le <date>. <cause> » et deux boutons', () => {
    const w = mountBanner(held({ alert: 'HELD' }))
    const b = w.find('[data-test="payment-alert-banner"]')
    expect(b.attributes('data-tone')).toBe('danger')
    expect(b.text()).toContain('À traiter : versement retenu depuis le 19 octobre 2026. Le voyageur a été banni.')
    expect(w.find('[data-test="banner-refund"]').text()).toBe('Rembourser l’expéditeur')
    expect(w.find('[data-test="banner-override"]').text()).toBe('Payer le voyageur (dérogation)')
  })

  it('ancien back (pas de champ alert) : la retenue est déduite des champs de retenue', () => {
    const w = mountBanner(held({ beneficiaryHoldReason: 'KYC_REVOKED', payoutHeldAt: null }))
    expect(w.find('[data-test="payment-alert-banner"]').text()).toContain('À traiter : versement retenu. L’identité du voyageur a été révoquée.')
  })

  it('les boutons émettent le geste : remboursement, déblocage par dérogation', async () => {
    const w = mountBanner(held({ alert: 'HELD' }))
    await w.find('[data-test="banner-refund"]').trigger('click')
    await w.find('[data-test="banner-override"]').trigger('click')
    expect(w.emitted('act')).toEqual([['refund'], ['release']])
  })

  it('retenu après versement mobile money : « Payer le voyageur » relance le versement', async () => {
    const w = mountBanner(held({ alert: 'HELD', status: 'RELEASED', method: 'PAWAPAY', pawapayPayoutId: 'po1' }))
    await w.find('[data-test="banner-override"]').trigger('click')
    expect(w.emitted('act')).toEqual([['retry-payout']])
  })

  it('geste impossible : bouton grisé avec sa raison, aucun événement', async () => {
    const w = mountBanner(held({ alert: 'HELD' }), () => false)
    const refund = w.find('[data-test="banner-refund"]')
    expect(refund.attributes('aria-disabled')).toBe('true')
    expect(w.find(`#${refund.attributes('aria-describedby')}`).text()).toMatch(/permission manquante/i)
    await refund.trigger('click')
    expect(w.emitted('act')).toBeUndefined()
  })

  it('autre alerte : libellé de rang et indication, sans les boutons de retenue', () => {
    const w = mountBanner(pay({ alert: 'ESCROW_J48' }))
    const b = w.find('[data-test="payment-alert-banner"]')
    expect(b.attributes('data-tone')).toBe('warning')
    expect(b.text()).toContain('À traiter : en séquestre depuis plus de 48 h')
    expect(w.find('[data-test="banner-refund"]').exists()).toBe(false)
  })

  it('litige bancaire ouvert : lien vers le litige quand le back le donne', () => {
    const w = mountBanner(pay({ alert: 'CHARGEBACK_OPEN', links: { chargebackId: CB } }))
    expect(w.find('[data-test="banner-chargeback-link"]').attributes('href')).toContain(CB)
    expect(mountBanner(pay({ alert: 'CHARGEBACK_OPEN' })).find('[data-test="banner-chargeback-link"]').exists()).toBe(false)
  })

  it('code inconnu : rien', () => {
    expect(mountBanner(pay({ alert: 'PIRATE' as never })).find('[data-test="payment-alert-banner"]').exists()).toBe(false)
  })

  it('checkout abandonné : bandeau neutre « rien à faire » (texte d’origine)', () => {
    const insight = { abandoned: true } as PaymentInsight
    const w = mountBanner(pay({ status: 'PENDING', insight }))
    expect(w.find('[data-test="payment-alert-banner"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-abandoned-notice"]').text()).toBe('Checkout abandonné : le paiement est en attente depuis plus de 24 h, le client ne l’a jamais terminé. Aucun argent n’a bougé, rien à faire.')
  })
})
