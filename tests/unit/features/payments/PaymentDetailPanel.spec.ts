import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

/** Les gestes vivent dans le menu « Actions » du tiroir : on l'ouvre avant de les chercher. */
async function openActions(w: ReturnType<typeof mount>) {
  await w.find('[data-test="payment-actions-menu"]').trigger('click')
}
/** Geste listé mais impossible : visible, `aria-disabled`, et son clic n'ouvre aucun dialogue. */
async function expectBlocked(w: ReturnType<typeof mount>, id: string) {
  const b = w.find(`[data-test="${id}"]`)
  expect(b.attributes('aria-disabled')).toBe('true')
  await b.trigger('click')
  expect(w.findComponent({ name: 'ConfirmActionDialog' }).props('open')).toBe(false)
  expect(w.find('[data-test="override-dialog"]').exists()).toBe(false)
}

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

  it('shows action buttons for ESCROW status', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    await openActions(wrapper)
    expect(wrapper.find('[data-test="action-release"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="action-refund"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="action-release"]').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="action-refund"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('hides action buttons for non-ESCROW status', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'RELEASED' },
        open: true,
      },
    })
    await openActions(wrapper)
    await expectBlocked(wrapper, 'action-release')
    await expectBlocked(wrapper, 'action-refund')
  })

  it('emits force-release when release confirmed', async () => {
    const wrapper = mount(PaymentDetailPanel, {
      props: {
        payment: { ...mockPayment, status: 'ESCROW' },
        open: true,
      },
    })
    await openActions(wrapper)
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
    await openActions(wrapper)
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
    await openActions(wrapper)
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

  it('SUPPORT ne voit ni « Débloquer » ni « Rembourser » sur un paiement en ESCROW', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true } })
    await openActions(w)
    await expectBlocked(w, 'action-release')
    await expectBlocked(w, 'action-refund')
    expect(w.find('[data-test="release-disabled-reason"]').text()).toMatch(/permission manquante/i)
    expect(w.find('[data-test="refund-disabled-reason"]').text()).toMatch(/permission manquante/i)
    expect(w.find('[data-test="banner-refund"]').exists()).toBe(false)
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

  it('propose « Relancer le versement » sur un paiement mobile money RELEASED', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED' }, open: true } })
    await openActions(w)
    expect(w.find('[data-test="action-retry-payout"]').text()).toContain('Relancer le versement')
    expect(w.find('[data-test="action-retry-payout"]').attributes('aria-disabled')).toBeUndefined()
    await expectBlocked(w, 'action-retry-refund')
  })

  it.each(['REFUNDED', 'CANCELLED'])('propose « Relancer le remboursement » sur un paiement mobile money %s', async (status) => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status }, open: true } })
    await openActions(w)
    expect(w.find('[data-test="action-retry-refund"]').text()).toContain('Relancer le remboursement')
    expect(w.find('[data-test="action-retry-refund"]').attributes('aria-disabled')).toBeUndefined()
    await expectBlocked(w, 'action-retry-payout')
  })

  it('aucune relance sur un paiement carte, même RELEASED', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, status: 'RELEASED' }, open: true } })
    await openActions(w)
    await expectBlocked(w, 'action-retry-payout')
  })

  it('aucune relance de versement sans opération de versement connue', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED', pawapayPayoutId: null }, open: true } })
    await openActions(w)
    await expectBlocked(w, 'action-retry-payout')
  })

  it('aucune relance de remboursement sans opération de remboursement connue', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'CANCELLED', pawapayRefundId: null }, open: true } })
    await openActions(w)
    await expectBlocked(w, 'action-retry-refund')
  })

  it('aucune relance sur ESCROW', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'ESCROW' }, open: true } })
    await openActions(w)
    await expectBlocked(w, 'action-retry-payout')
    await expectBlocked(w, 'action-retry-refund')
  })

  it('confirme avant d’émettre retry-payout', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED' }, open: true } })
    await openActions(w)
    await w.find('[data-test="action-retry-payout"]').trigger('click')
    expect(w.emitted('retry-payout')).toBeFalsy()
    const dialog = w.findComponent({ name: 'ConfirmActionDialog' })
    expect(dialog.props('title')).toBe('Relancer le versement')
    await dialog.vm.$emit('confirm', '')
    expect(w.emitted('retry-payout')).toBeTruthy()
  })

  it('confirme avant d’émettre retry-refund', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'REFUNDED' }, open: true } })
    await openActions(w)
    await w.find('[data-test="action-retry-refund"]').trigger('click')
    const dialog = w.findComponent({ name: 'ConfirmActionDialog' })
    expect(dialog.props('title')).toBe('Relancer le remboursement')
    await dialog.vm.$emit('confirm', '')
    expect(w.emitted('retry-refund')).toBeTruthy()
  })

  it('désactive la relance pendant l’envoi', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED' }, open: true, busy: true } })
    await openActions(w)
    const b = w.find('[data-test="action-retry-payout"]')
    expect(b.attributes('disabled')).toBeDefined()
    expect(b.text()).toContain('En cours')
  })

  it('SUPPORT (sans PAYMENT_RELEASE) ne voit aucune relance', async () => {
    seedAuth('SUPPORT')
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'RELEASED' }, open: true } })
    await openActions(w)
    await expectBlocked(w, 'action-retry-payout')
    const w2 = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'REFUNDED' }, open: true } })
    await openActions(w2)
    await expectBlocked(w2, 'action-retry-refund')
  })

  it('un ADMIN privé de PAYMENT_RELEASE mais avec PAYMENT_REFUND ne voit pas la relance de remboursement', async () => {
    seedAuth('ADMIN', { PAYMENT_RELEASE: false })
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mm, status: 'REFUNDED' }, open: true } })
    await openActions(w)
    await expectBlocked(w, 'action-retry-refund')
    expect(w.find('[data-test="retry-refund-disabled-reason"]').text()).toMatch(/permission manquante/i)
  })
})

describe('PaymentDetailPanel : encaissement, fil de négociation et resynchronisation Stripe', () => {
  beforeEach(() => seedAuth('ADMIN'))
  const insight = { kind: 'NEGOTIATION', bidId: null, negotiationThreadId: 'thr_ctx', sender: null, traveler: null, departureCity: null, arrivalCity: null, bidStatus: null, abandoned: false, netTravelerCents: 8800, capturedAt: null, fxExchangeRate: null, stripeChargeId: null, stripeDashboardUrl: null }

  it('« Encaissé le … » quand capturedAt est connu', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, capturedAt: '2026-10-10T08:00:00Z' }, open: true, section: 'money' } })
    expect(w.find('[data-test="payment-captured"]').text()).toMatch(/Encaissé le .*2026/)
  })

  it('« Non encaissé » quand le back dit null', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, capturedAt: null }, open: true, section: 'money' } })
    expect(w.find('[data-test="payment-captured"]').text()).toContain('Non encaissé')
  })

  it('ancien back sans capturedAt : repli sur le contexte, sinon rien', () => {
    const withInsight = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, insight: { ...insight, capturedAt: '2026-10-09T08:00:00Z' } }, open: true, section: 'money' } })
    expect(withInsight.find('[data-test="payment-captured"]').text()).toContain('Encaissé le')
    const bare = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'money' } })
    expect(bare.find('[data-test="payment-captured"]').exists()).toBe(false)
  })

  it('fil de négociation du détail, à défaut du contexte, copiable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, negotiationThreadId: 'thr_1', insight }, open: true, section: 'references' } })
    expect(w.find('[data-test="payment-thread"]').text()).toContain('thr_1')
    await w.find('[data-test="payment-copy-thread"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith('thr_1')
    const fallback = mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, insight }, open: true, section: 'references' } })
    expect(fallback.find('[data-test="payment-thread"]').text()).toContain('thr_ctx')
  })

  it('bouton « Resynchroniser avec Stripe » pour un paiement carte seulement', () => {
    expect(mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'money' } }).find('[data-test="payment-resync"]').exists()).toBe(true)
    expect(mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, method: 'PAWAPAY' }, open: true, section: 'money' } }).find('[data-test="payment-resync"]').exists()).toBe(false)
    expect(mount(PaymentDetailPanel, { props: { payment: { ...mockPayment, stripePaymentIntentId: null }, open: true, section: 'money' } }).find('[data-test="payment-resync"]').exists()).toBe(false)
  })

  it('resynchronisation terminée : émet resynced pour recharger la fiche', async () => {
    seedAuth('SUPER_ADMIN')
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'money' } })
    w.findComponent({ name: 'StripeResyncPanel' }).vm.$emit('done', {})
    expect(w.emitted('resynced')).toHaveLength(1)
  })
})

/**
 * Coquille à onglets (Résumé · Argent · Chronologie · Incidents · Références) : en-tête, bandeau,
 * menu « Actions », onglet piloté par `section` (l'URL), Échap qui ne ferme que la modale du dessus.
 */
describe('PaymentDetailPanel : coquille à onglets', () => {
  beforeEach(() => seedAuth('ADMIN'))
  const tabIds = (w: ReturnType<typeof mount>) => w.findAll('[data-test^="payment-tab-"]').map(t => t.attributes('data-test'))

  it('dialogue modal nommé par son titre, cinq onglets, Résumé par défaut', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true } })
    const aside = w.find('aside')
    expect(aside.attributes('role')).toBe('dialog')
    expect(aside.attributes('aria-modal')).toBe('true')
    expect(aside.attributes('aria-labelledby')).toBe('payment-detail-title')
    expect(tabIds(w)).toEqual(['payment-tab-summary', 'payment-tab-money', 'payment-tab-timeline', 'payment-tab-incidents', 'payment-tab-references'])
    expect(w.find('[data-test="payment-panel-summary"]').exists()).toBe(true)
  })

  it('onglet reçu en prop (URL) affiché ; clic sur un onglet : update:section', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'references' } })
    expect(w.find('[data-test="payment-references"]').exists()).toBe(true)
    await w.find('[data-test="payment-tab-incidents"]').trigger('click')
    expect(w.emitted('update:section')?.at(-1)).toEqual(['incidents'])
    expect(w.find('[data-test="payment-panel-incidents"]').exists()).toBe(true)
  })

  it('onglet inconnu : Résumé, et l’URL est corrigée', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'pirate' } })
    expect(w.find('[data-test="payment-panel-summary"]').exists()).toBe(true)
    expect(w.emitted('update:section')?.at(-1)).toEqual(['summary'])
  })

  it('chaque onglet garde le contenu d’avant : montants, chronologie, retenue, références', () => {
    const held = { ...mockPayment, beneficiaryHeld: true, beneficiaryHoldReason: 'BANNED', payoutHeldAt: '2026-09-20T10:00:00Z' }
    expect(mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'money' } }).find('[data-test="payment-amounts"]').exists()).toBe(true)
    expect(mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'timeline' } }).findComponent({ name: 'PaymentTimeline' }).exists()).toBe(true)
    expect(mount(PaymentDetailPanel, { props: { payment: held, open: true, section: 'incidents' } }).find('[data-test="payment-hold-notice"]').exists()).toBe(true)
    expect(mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'references' } }).text()).toContain('pay_123')
  })

  it('erreur d’un geste : affichée au-dessus des onglets, quel que soit l’onglet', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true, section: 'timeline', error: 'Refus du serveur' } })
    expect(w.find('[data-test="payment-error"]').text()).toBe('Refus du serveur')
  })

  it('bandeau du paiement retenu : « Rembourser l’expéditeur » ouvre le dialogue habituel, « Payer le voyageur » la dérogation', async () => {
    const held = { ...mockPayment, beneficiaryHeld: true, beneficiaryHoldReason: 'BANNED', payoutHeldAt: '2026-09-20T10:00:00Z' }
    const w = mount(PaymentDetailPanel, { props: { payment: held, open: true } })
    await w.find('[data-test="banner-refund"]').trigger('click')
    expect(w.findComponent({ name: 'ConfirmActionDialog' }).props('title')).toBe('Rembourser l\'expéditeur')
    await w.findComponent({ name: 'ConfirmActionDialog' }).vm.$emit('confirm')
    expect(w.emitted('refund')).toHaveLength(1)
    await w.find('[data-test="banner-override"]').trigger('click')
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(true)
  })

  it('Échap ferme le tiroir, mais pas quand une confirmation est ouverte par-dessus', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true }, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)
    await openActions(w)
    await w.find('[data-test="action-refund"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })

  it('confirmation fermée : le focus revient sur « Actions »', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: mockPayment, open: true }, attachTo: document.body })
    await openActions(w)
    await w.find('[data-test="action-refund"]').trigger('click')
    await w.findComponent({ name: 'ConfirmActionDialog' }).vm.$emit('cancel')
    await flushPromises()
    expect(document.activeElement?.getAttribute('data-test')).toBe('payment-actions-menu')
    w.unmount()
  })
})
