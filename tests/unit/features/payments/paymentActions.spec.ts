/**
 * Gestes du menu « Actions » du tiroir paiement : mêmes gardes que l'ancien panneau (permission,
 * rail, statut, opération pawaPay connue), mais une action impossible reste listée avec sa raison.
 */
import { describe, it, expect } from 'vitest'
import { paymentActions, type PaymentAction } from '@/features/payments/lib/paymentActions'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import type { AdminPermission } from '@/stores/auth'

const pay = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
  id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 100, currency: 'EUR',
  createdAt: '2026-10-19T14:02:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false, ...over,
})
const all = () => true
const without = (...denied: AdminPermission[]) => (p: AdminPermission) => !denied.includes(p)
const find = (list: PaymentAction[], id: PaymentAction['id']) => list.find(a => a.id === id)!
const mm = (over: Partial<AdminPaymentDetail> = {}) => pay({ method: 'PAWAPAY', currency: 'XOF', stripePaymentIntentId: null, pawapayDepositId: 'd1', pawapayPayoutId: 'po1', pawapayRefundId: 'r1', ...over })

describe('paymentActions', () => {
  it('toujours les quatre gestes, dans le même ordre', () => {
    expect(paymentActions(pay(), all, false).map(a => a.id)).toEqual(['release', 'refund', 'retry-payout', 'retry-refund'])
    expect(paymentActions(pay({ status: 'FAILED' }), without('PAYMENT_RELEASE', 'PAYMENT_REFUND'), false)).toHaveLength(4)
  })

  it('ESCROW + PAYMENT_RELEASE : « Débloquer » activé, sans raison', () => {
    const release = find(paymentActions(pay(), all, false), 'release')
    expect(release).toMatchObject({ enabled: true, label: 'Débloquer (force-release)', tone: 'success', override: false })
    expect(release.reason).toBeUndefined()
  })

  it('sans PAYMENT_RELEASE : « Débloquer » grisé avec la raison « permission manquante »', () => {
    const release = find(paymentActions(pay(), without('PAYMENT_RELEASE'), false), 'release')
    expect(release.enabled).toBe(false)
    expect(release.reason).toMatch(/permission manquante/i)
  })

  it('« Rembourser » : PAYMENT_REFUND et séquestre exigés', () => {
    expect(find(paymentActions(pay(), all, false), 'refund')).toMatchObject({ enabled: true, tone: 'warning' })
    expect(find(paymentActions(pay(), without('PAYMENT_REFUND'), false), 'refund').reason).toMatch(/permission manquante/i)
    const released = find(paymentActions(pay({ status: 'RELEASED' }), all, false), 'refund')
    expect(released.enabled).toBe(false)
    expect(released.reason).toContain('séquestre')
  })

  it('hors séquestre : « Débloquer » grisé avec la raison', () => {
    const release = find(paymentActions(pay({ status: 'REFUNDED' }), all, false), 'release')
    expect(release.enabled).toBe(false)
    expect(release.reason).toContain('séquestre')
  })

  it('paiement retenu : le déblocage et la relance passent par la dérogation', () => {
    const list = paymentActions(pay(), all, true)
    expect(find(list, 'release')).toMatchObject({ enabled: true, override: true, label: 'Payer le voyageur (dérogation)' })
    expect(find(paymentActions(mm({ status: 'RELEASED' }), all, true), 'retry-payout')).toMatchObject({ enabled: true, override: true })
    expect(find(list, 'refund').override).toBe(false)
  })

  it('« Relancer le versement » : mobile money RELEASED avec un versement connu', () => {
    expect(find(paymentActions(mm({ status: 'RELEASED' }), all, false), 'retry-payout')).toMatchObject({ enabled: true, tone: 'primary' })
  })

  it('RELEASED mobile money sans pawapayPayoutId : « Relancer le versement » grisé avec la raison', () => {
    const a = find(paymentActions(mm({ status: 'RELEASED', pawapayPayoutId: null }), all, false), 'retry-payout')
    expect(a.enabled).toBe(false)
    expect(a.reason).toContain('Aucun versement mobile money')
  })

  it('relances : rail carte, statut et permission donnent chacun leur raison', () => {
    expect(find(paymentActions(pay({ status: 'RELEASED' }), all, false), 'retry-payout').reason).toContain('mobile money')
    expect(find(paymentActions(mm({ status: 'ESCROW' }), all, false), 'retry-payout').reason).toContain('versé')
    expect(find(paymentActions(mm({ status: 'ESCROW' }), all, false), 'retry-refund').reason).toContain('remboursé ou annulé')
    expect(find(paymentActions(mm({ status: 'RELEASED' }), without('PAYMENT_RELEASE'), false), 'retry-payout').reason).toMatch(/permission manquante/i)
  })

  it.each(['REFUNDED', 'CANCELLED'] as const)('« Relancer le remboursement » sur un paiement mobile money %s', (status) => {
    expect(find(paymentActions(mm({ status }), all, false), 'retry-refund')).toMatchObject({ enabled: true, tone: 'warning' })
  })

  it('« Relancer le remboursement » exige PAYMENT_RELEASE, même avec PAYMENT_REFUND, et un remboursement connu', () => {
    expect(find(paymentActions(mm({ status: 'REFUNDED' }), without('PAYMENT_RELEASE'), false), 'retry-refund').enabled).toBe(false)
    const a = find(paymentActions(mm({ status: 'CANCELLED', pawapayRefundId: null }), all, false), 'retry-refund')
    expect(a.enabled).toBe(false)
    expect(a.reason).toContain('Aucun remboursement mobile money')
  })
})
