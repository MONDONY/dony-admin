import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

const mockPayment = {
  id: 'pay_123',
  status: 'ESCROW',
  bidId: 'bid_456',
  method: 'STRIPE',
  amountCents: 10000,
  commissionCents: 1200,
  currency: 'EUR',
  refundedCents: 0,
  stripePaymentIntentId: 'pi_xxx',
}

describe('PaymentDetailPanel', () => {
  beforeEach(() => seedAuth('ADMIN'))
  it('renders when open prop is true', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: true,
      },
    })
    expect(wrapper.find('.fixed').exists()).toBe(true)
  })

  it('affiche le montant dans la devise du paiement (XOF), jamais en euros par défaut', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: { payment: { ...mockPayment, method: 'PAWAPAY', currency: 'XOF', amountCents: 660000 }, open: true },
    })
    const montant = wrapper.find('[data-test="payment-detail-amount"]').text()
    expect(montant).toContain('XOF')
    expect(montant).not.toContain('€')
    expect(wrapper.text()).toContain('Mobile money')
  })

  it('emits close event on close button', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: true,
      },
    })
    await wrapper.find('[data-test="payment-close"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows action buttons for ESCROW status', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    expect(wrapper.find('[data-test="action-release"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="action-refund"]').exists()).toBe(true)
  })

  it('hides action buttons for non-ESCROW status', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'RELEASED' },
        open: true,
      },
    })
    expect(wrapper.find('[data-test="action-release"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="action-refund"]').exists()).toBe(false)
  })

  it('emits force-release when release confirmed', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    await wrapper.find('[data-test="action-release"]').trigger('click')
    // Simulate dialog confirmation
    const dialog = wrapper.findComponent({ name: 'ConfirmActionDialog' })
    await dialog.vm.$emit('confirm')
    expect(wrapper.emitted('force-release')).toBeTruthy()
  })

  it('emits refund when refund confirmed', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    await wrapper.find('[data-test="action-refund"]').trigger('click')
    const dialog = wrapper.findComponent({ name: 'ConfirmActionDialog' })
    await dialog.vm.$emit('confirm')
    expect(wrapper.emitted('refund')).toBeTruthy()
  })

  it('displays payment details correctly', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: true,
      },
    })
    expect(wrapper.text()).toContain('bid_456')
    expect(wrapper.text()).toContain('Carte')
  })

  it('cancels dialog on cancel', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    await wrapper.find('[data-test="action-release"]').trigger('click')
    const dialog = wrapper.findComponent({ name: 'ConfirmActionDialog' })
    await dialog.vm.$emit('cancel')
    expect(wrapper.emitted('force-release')).toBeFalsy()
  })

  it('does not render when open prop is false', () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: false,
      },
    })
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })

  it('closes on backdrop click', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: mockPayment,
        open: true,
      },
    })
    await wrapper.find('.fixed').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})

/**
 * Les deux seuls gestes de mouvement d'argent du back-office. SUPPORT ne détient ni
 * `PAYMENT_RELEASE` ni `PAYMENT_REFUND` : sans ces cas négatifs, supprimer les `v-if`
 * laisserait la suite verte et rouvrirait les deux boutons à un rôle qui prend un 403.
 */
describe('PaymentDetailPanel — gardes vues depuis un rôle sans les permissions', () => {
  beforeEach(() => seedAuth('SUPPORT'))

  it('SUPPORT ne voit ni « Débloquer » ni « Rembourser » sur un paiement en ESCROW', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true } })
    expect(w.find('[data-test="action-release"]').exists()).toBe(false)
    expect(w.find('[data-test="action-refund"]').exists()).toBe(false)
  })

  it('SUPPORT garde bien l’accès en consultation au panneau', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true } })
    expect(w.find('[data-test="payment-close"]').exists()).toBe(true)
  })
})

/**
 * Relances mobile money : le back n'accepte la relance de versement que sur un paiement
 * pawaPay RELEASED, celle du remboursement que sur REFUNDED ou CANCELLED, et toutes deux
 * exigent PAYMENT_RELEASE (AdminPaymentController). Sans opération connue du bon type,
 * il répond 422 « introuvable » : le bouton ne s'affiche donc pas non plus.
 */
describe('PaymentDetailPanel : relances mobile money', () => {
  const mm = { ...mockPayment, method: 'PAWAPAY', currency: 'XOF', stripePaymentIntentId: null, pawapayDepositId: 'd1', pawapayPayoutId: 'po1', pawapayRefundId: 'r1' }
  beforeEach(() => seedAuth('ADMIN'))

  it('propose « Relancer le versement » sur un paiement mobile money RELEASED', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED' }, open: true } })
    expect(w.find('[data-test="action-retry-payout"]').text()).toContain('Relancer le versement')
    expect(w.find('[data-test="action-retry-refund"]').exists()).toBe(false)
  })

  it.each(['REFUNDED', 'CANCELLED'])('propose « Relancer le remboursement » sur un paiement mobile money %s', (status) => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status }, open: true } })
    expect(w.find('[data-test="action-retry-refund"]').text()).toContain('Relancer le remboursement')
    expect(w.find('[data-test="action-retry-payout"]').exists()).toBe(false)
  })

  it('aucune relance sur un paiement carte, même RELEASED', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, status: 'RELEASED' }, open: true } })
    expect(w.find('[data-test="action-retry-payout"]').exists()).toBe(false)
  })

  it('aucune relance de versement sans opération de versement connue', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED', pawapayPayoutId: null }, open: true } })
    expect(w.find('[data-test="action-retry-payout"]').exists()).toBe(false)
  })

  it('aucune relance de remboursement sans opération de remboursement connue', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'CANCELLED', pawapayRefundId: null }, open: true } })
    expect(w.find('[data-test="action-retry-refund"]').exists()).toBe(false)
  })

  it('aucune relance sur ESCROW', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'ESCROW' }, open: true } })
    expect(w.find('[data-test="action-retry-payout"]').exists()).toBe(false)
    expect(w.find('[data-test="action-retry-refund"]').exists()).toBe(false)
  })

  it('confirme avant d’émettre retry-payout', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED' }, open: true } })
    await w.find('[data-test="action-retry-payout"]').trigger('click')
    expect(w.emitted('retry-payout')).toBeFalsy()
    const dialog = w.findComponent({ name: 'ConfirmActionDialog' })
    expect(dialog.props('title')).toBe('Relancer le versement')
    await dialog.vm.$emit('confirm', '')
    expect(w.emitted('retry-payout')).toBeTruthy()
  })

  it('confirme avant d’émettre retry-refund', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'REFUNDED' }, open: true } })
    await w.find('[data-test="action-retry-refund"]').trigger('click')
    const dialog = w.findComponent({ name: 'ConfirmActionDialog' })
    expect(dialog.props('title')).toBe('Relancer le remboursement')
    await dialog.vm.$emit('confirm', '')
    expect(w.emitted('retry-refund')).toBeTruthy()
  })

  it('désactive la relance pendant l’envoi', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED' }, open: true, busy: true } })
    const b = w.find('[data-test="action-retry-payout"]')
    expect(b.attributes('disabled')).toBeDefined()
    expect(b.text()).toContain('En cours')
  })

  it('SUPPORT (sans PAYMENT_RELEASE) ne voit aucune relance', () => {
    seedAuth('SUPPORT')
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED' }, open: true } })
    expect(w.find('[data-test="action-retry-payout"]').exists()).toBe(false)
    const w2 = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'REFUNDED' }, open: true } })
    expect(w2.find('[data-test="action-retry-refund"]').exists()).toBe(false)
  })

  it('un ADMIN privé de PAYMENT_RELEASE mais avec PAYMENT_REFUND ne voit pas la relance de remboursement', () => {
    seedAuth('ADMIN', { PAYMENT_RELEASE: false })
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'REFUNDED' }, open: true } })
    expect(w.find('[data-test="action-retry-refund"]').exists()).toBe(false)
  })
})

describe('PaymentDetailPanel : encaissement, fil de négociation et resynchronisation Stripe', () => {
  beforeEach(() => seedAuth('ADMIN'))
  const insight = { kind: 'NEGOTIATION', bidId: null, negotiationThreadId: 'thr_ctx', sender: null, traveler: null, departureCity: null, arrivalCity: null, bidStatus: null, abandoned: false, netTravelerCents: 8800, capturedAt: null, fxExchangeRate: null, stripeChargeId: null, stripeDashboardUrl: null }

  it('« Encaissé le … » quand capturedAt est connu', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, capturedAt: '2026-10-10T08:00:00Z' }, open: true } })
    expect(w.find('[data-test="payment-captured"]').text()).toMatch(/Encaissé le .*2026/)
  })

  it('« Non encaissé » quand le back dit null', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, capturedAt: null }, open: true } })
    expect(w.find('[data-test="payment-captured"]').text()).toContain('Non encaissé')
  })

  it('ancien back sans capturedAt : repli sur le contexte, sinon rien', () => {
    const withInsight = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, insight: { ...insight, capturedAt: '2026-10-09T08:00:00Z' } }, open: true } })
    expect(withInsight.find('[data-test="payment-captured"]').text()).toContain('Encaissé le')
    const bare = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true } })
    expect(bare.find('[data-test="payment-captured"]').exists()).toBe(false)
  })

  it('fil de négociation du détail, à défaut du contexte, copiable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, negotiationThreadId: 'thr_1', insight }, open: true } })
    expect(w.find('[data-test="payment-thread"]').text()).toContain('thr_1')
    await w.find('[data-test="payment-copy-thread"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith('thr_1')
    const fallback = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, insight }, open: true } })
    expect(fallback.find('[data-test="payment-thread"]').text()).toContain('thr_ctx')
  })

  it('bouton « Resynchroniser avec Stripe » pour un paiement carte seulement', () => {
    expect(mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true } }).find('[data-test="payment-resync"]').exists()).toBe(true)
    expect(mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, method: 'PAWAPAY' }, open: true } }).find('[data-test="payment-resync"]').exists()).toBe(false)
    expect(mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, stripePaymentIntentId: null }, open: true } }).find('[data-test="payment-resync"]').exists()).toBe(false)
  })

  it('resynchronisation terminée : émet resynced pour recharger la fiche', async () => {
    seedAuth('SUPER_ADMIN')
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true } })
    w.findComponent({ name: 'StripeResyncPanel' }).vm.$emit('done', {})
    expect(w.emitted('resynced')).toHaveLength(1)
  })
})
