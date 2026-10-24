/** En-tête du tiroir paiement : trajet, type, statut, n° de suivi copiable, date, fermeture. */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentDrawerHeader from '@/features/payments/components/PaymentDrawerHeader.vue'
import type { AdminPaymentDetail, PaymentInsight } from '@/features/payments/types/index'

const insight = { kind: 'NEGOTIATION', departureCity: 'Paris', arrivalCity: 'Dakar' } as PaymentInsight
const pay = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
  id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 100, currency: 'EUR',
  createdAt: '2026-10-19T14:02:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false, ...over,
})
const mountHeader = (payment: AdminPaymentDetail, copied: string | null = null) =>
  mount(PaymentDrawerHeader, { props: { payment, copied }, slots: { actions: '<button data-test="slot-actions">Actions</button>' } })

describe('PaymentDrawerHeader', () => {
  it('trajet en titre, type, statut, méthode et date de création', () => {
    const w = mountHeader(pay({ insight, trackingNumber: 'YD-8F3K2Q' }))
    expect(w.find('#payment-detail-title').text()).toBe('Paris → Dakar')
    expect(w.find('[data-test="payment-kind"]').text()).toBe('Négociation')
    expect(w.find('[data-test="payment-status"]').text()).toBe('Sous séquestre')
    const meta = w.find('[data-test="payment-meta"]').text()
    expect(meta).toContain('Carte')
    expect(meta).toMatch(/créé le 19 oct\. 2026/)
    expect(w.find('[data-test="slot-actions"]').exists()).toBe(true)
  })

  it('sans trajet connu : « Paiement » ; sans contexte : pas de badge de type', () => {
    const w = mountHeader(pay())
    expect(w.find('#payment-detail-title').text()).toBe('Paiement')
    expect(w.find('[data-test="payment-kind"]').exists()).toBe(false)
  })

  it('n° de suivi avec « Copier » ; absent : pas de bouton', async () => {
    const w = mountHeader(pay({ trackingNumber: 'YD-8F3K2Q' }))
    expect(w.find('[data-test="payment-tracking"]').text()).toBe('YD-8F3K2Q')
    await w.find('[data-test="payment-copy-tracking"]').trigger('click')
    expect(w.emitted('copy')).toEqual([['tracking', 'YD-8F3K2Q']])
    expect(mountHeader(pay({ trackingNumber: 'YD-8F3K2Q' }), 'tracking').find('[data-test="payment-copy-tracking"]').text()).toBe('Copié')
    expect(mountHeader(pay()).find('[data-test="payment-copy-tracking"]').exists()).toBe(false)
  })

  it('badge « Versement retenu » sur un paiement retenu seulement', () => {
    expect(mountHeader(pay({ beneficiaryHeld: true })).find('[data-test="payment-held-badge"]').text()).toBe('Versement retenu')
    expect(mountHeader(pay()).find('[data-test="payment-held-badge"]').exists()).toBe(false)
  })

  it('✕ ferme, avec un nom accessible', async () => {
    const w = mountHeader(pay())
    const x = w.find('[data-test="payment-close-icon"]')
    expect(x.attributes('aria-label')).toBe('Fermer la fiche')
    await x.trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })
})
