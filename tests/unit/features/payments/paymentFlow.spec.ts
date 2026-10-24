/** Parcours de l'argent du tiroir paiement : Payé → Encaissé → Colis livré → Versé / Remboursé. */
import { describe, it, expect } from 'vitest'
import { paymentFlow } from '@/features/payments/lib/paymentFlow'
import type { AdminPaymentDetail, PaymentInsight } from '@/features/payments/types/index'

const insight = (over: Partial<PaymentInsight> = {}): PaymentInsight => ({
  kind: 'BID', bidId: 'b1', negotiationThreadId: null, sender: null, traveler: null, departureCity: 'Paris', arrivalCity: 'Dakar',
  bidStatus: 'IN_TRANSIT', abandoned: false, netTravelerCents: 900, capturedAt: null, fxExchangeRate: null, stripeChargeId: null,
  stripeDashboardUrl: null, ...over,
})
const pay = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
  id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 100, currency: 'EUR',
  createdAt: '2026-10-19T14:02:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false, ...over,
})
const states = (p: AdminPaymentDetail) => paymentFlow(p).steps.map(s => s.state)
const labels = (p: AdminPaymentDetail) => paymentFlow(p).steps.map(s => s.label)

describe('paymentFlow', () => {
  it('quatre étapes dans l’ordre du parcours', () => {
    expect(paymentFlow(pay()).steps.map(s => s.id)).toEqual(['paid', 'captured', 'delivered', 'outcome'])
    expect(labels(pay())).toEqual(['Payé', 'Encaissé', 'Colis livré', 'Versé'])
  })

  it('carte libérée : quatre étapes faites, avec les dates connues', () => {
    const steps = paymentFlow(pay({
      status: 'RELEASED', capturedAt: '2026-10-19T15:00:00', escrowReleasedAt: '2026-10-21T09:00:00',
      insight: insight({ bidStatus: 'COMPLETED' }),
    })).steps
    expect(steps.map(s => s.state)).toEqual(['done', 'done', 'done', 'done'])
    expect(steps[0]!.date).toBe('2026-10-19T14:02:00')
    expect(steps[1]!.date).toBe('2026-10-19T15:00:00')
    expect(steps[3]!.date).toBe('2026-10-21T09:00:00')
  })

  it('carte : la date d’encaissement du contexte sert de repli (ancien back)', () => {
    const steps = paymentFlow(pay({ insight: insight({ capturedAt: '2026-10-19T16:00:00' }) })).steps
    expect(steps[1]).toMatchObject({ state: 'done', date: '2026-10-19T16:00:00' })
  })

  it('séquestre encaissé, colis en route : l’étape « Colis livré » est en cours', () => {
    expect(states(pay({ capturedAt: '2026-10-19T15:00:00' }))).toEqual(['done', 'done', 'current', 'todo'])
  })

  it('séquestre carte pas encore encaissé : « Encaissé » en cours', () => {
    expect(states(pay({ capturedAt: null }))).toEqual(['done', 'current', 'todo', 'todo'])
  })

  it('versement retenu : dernière étape en arrêt « Versement retenu »', () => {
    const steps = paymentFlow(pay({
      capturedAt: '2026-10-19T15:00:00', payoutHeldAt: '2026-10-21T10:00:00', beneficiaryHeld: true,
      insight: insight({ bidStatus: 'COMPLETED' }),
    })).steps
    expect(steps.map(s => s.state)).toEqual(['done', 'done', 'done', 'stop'])
    expect(steps[3]!.label).toBe('Versement retenu')
  })

  it('versement mobile money échoué : dernière étape en arrêt', () => {
    const steps = paymentFlow(pay({ status: 'RELEASED', method: 'PAWAPAY', alert: 'MM_FAILED', pawapayDepositId: 'd1', pawapayPayoutId: 'po1' })).steps
    expect(steps[3]).toMatchObject({ state: 'stop', label: 'Versement échoué' })
  })

  it('checkout abandonné : aucune étape faite après la première', () => {
    const s = states(pay({ status: 'PENDING', insight: insight({ abandoned: true }) }))
    expect(s.slice(1).every(x => x === 'todo')).toBe(true)
    expect(paymentFlow(pay({ status: 'PENDING', insight: insight({ abandoned: true }) })).steps[0]).toMatchObject({ state: 'stop', label: 'Checkout abandonné' })
  })

  it('en attente du paiement : la première étape est en cours', () => {
    expect(states(pay({ status: 'PENDING' }))).toEqual(['current', 'todo', 'todo', 'todo'])
  })

  it('paiement échoué : arrêt dès la première étape', () => {
    const steps = paymentFlow(pay({ status: 'FAILED' })).steps
    expect(steps.map(s => s.state)).toEqual(['stop', 'todo', 'todo', 'todo'])
    expect(steps[0]!.label).toBe('Paiement échoué')
  })

  it('remboursé : dernière étape « Remboursé » faite, la livraison n’a pas eu lieu', () => {
    const steps = paymentFlow(pay({ status: 'REFUNDED', capturedAt: '2026-10-19T15:00:00', refundedCents: 1000 })).steps
    expect(steps.map(s => s.state)).toEqual(['done', 'done', 'todo', 'done'])
    expect(steps[3]!.label).toBe('Remboursé')
  })

  it('mobile money : « Encaissé » fait dès le dépôt connu', () => {
    expect(states(pay({ method: 'PAWAPAY', stripePaymentIntentId: null, pawapayDepositId: 'd1' }))).toEqual(['done', 'done', 'current', 'todo'])
  })

  it('annulé sans argent pris : arrêt « Paiement annulé » ; mobile money remboursé : « Remboursé »', () => {
    const card = paymentFlow(pay({ status: 'CANCELLED', capturedAt: null })).steps
    expect(card[0]).toMatchObject({ state: 'stop', label: 'Paiement annulé' })
    const mm = paymentFlow(pay({ status: 'CANCELLED', method: 'PAWAPAY', pawapayDepositId: 'd1', pawapayRefundId: 'r1' })).steps
    expect(mm.map(s => s.state)).toEqual(['done', 'done', 'todo', 'done'])
    expect(mm[3]!.label).toBe('Remboursé')
  })
})
