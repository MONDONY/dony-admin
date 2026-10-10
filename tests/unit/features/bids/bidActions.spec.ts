import { describe, it, expect } from 'vitest'
import {
  BID_ACTION_UNAVAILABLE, cancelBlockedReason, cancelErrorMessage, cancelMoneyEffect, cancelSuccessMessage,
  disputeBlockedReason, disputeErrorMessage, disputeMoneyEffect, disputeSuccessMessage, parcelWithTraveler,
  CANCEL_REASONS, DISPUTE_REASONS,
} from '@/features/bids/lib/bidActions'
import type { AdminBidDetail } from '@/features/bids/types/index'

const base: AdminBidDetail = {
  id: '1c1a0000-0000-4000-8000-0000000000b2', status: 'ACCEPTED', announcementId: 'a1', senderName: 'Awa', travelerName: 'Moussa',
  corridor: 'Paris → Bamako', weightKg: 5, netEur: 40, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-06T18:53:35',
  contentCategory: null, recipientName: null, trackingNumber: null, commissionRate: 0.12, refusalReason: null,
  money: { paymentId: 'p1', status: 'ESCROW', rail: 'STRIPE', amountCents: 4800, commissionCents: 576, refundedCents: 0, currency: 'EUR',
    capturedAt: null, escrowReleasedAt: null, payoutHeldAt: null, disputed: false },
  links: { negotiationThreadId: null, disputeId: null, disputeStatus: null, conversationId: null, cancellationId: null },
}
const bid = (over: Partial<AdminBidDetail> = {}): AdminBidDetail => ({ ...base, ...over })
const money = (over: Partial<NonNullable<AdminBidDetail['money']>>) => ({ ...base.money!, ...over })
const err = (status: number, code?: string, detail?: string) => ({ statusCode: status, data: code || detail ? { code, detail } : undefined })

describe('bidActions', () => {
  it('catalogues de motifs complets et libellés en français', () => {
    expect(CANCEL_REASONS.map(r => r.value)).toContain('OTHER')
    expect(DISPUTE_REASONS.map(r => r.value)).toEqual(['PARCEL_DAMAGED', 'PARCEL_LOST', 'PARCEL_NOT_DELIVERED', 'CONTENT_MISMATCH', 'PAYMENT_DISAGREEMENT', 'PARTY_BEHAVIOUR', 'OTHER'])
  })

  it('annulation : possible avant livraison, refusée sinon avec la raison', () => {
    expect(cancelBlockedReason(bid())).toBeNull()
    expect(cancelBlockedReason(bid({ status: 'CANCELLED' }))).toBe('Colis déjà annulé.')
    expect(cancelBlockedReason(bid({ status: 'COMPLETED' }))).toContain('déjà livré')
    expect(cancelBlockedReason(bid({ status: 'NEGOTIATING' as never }))).toContain('discussion de prix')
    expect(cancelBlockedReason(bid({ status: 'EXPIRED' }))).toContain('déjà terminé')
    expect(cancelBlockedReason(bid({ money: money({ status: 'RELEASED' }) }))).toContain('déjà été payé')
    expect(cancelBlockedReason(bid({ money: money({ escrowReleasedAt: '2026-10-09T10:00:00' }) }))).toContain('déjà été payé')
    expect(cancelBlockedReason(bid({ money: money({ disputed: true }) }))).toContain('Litige bancaire')
    expect(cancelBlockedReason(bid({ links: { ...base.links!, disputeId: 'd1', disputeStatus: 'OPEN' } }))).toContain('litige est ouvert')
    expect(cancelBlockedReason(bid({ links: { ...base.links!, disputeId: 'd1', disputeStatus: 'RESOLVED' } }))).toBeNull()
  })

  it('litige : colis engagé seulement, jamais après versement', () => {
    expect(disputeBlockedReason(bid({ status: 'ARRIVED' as never }))).toBeNull()
    expect(disputeBlockedReason(bid({ status: 'PENDING' }))).toContain('Aucune transaction engagée')
    expect(disputeBlockedReason(bid({ links: { ...base.links!, disputeId: 'd1', disputeStatus: 'OPEN' } }))).toContain('déjà ouvert')
    expect(disputeBlockedReason(bid({ status: 'COMPLETED', money: money({ status: 'RELEASED' }) }))).toContain('déjà été payé')
  })

  it('colis chez le voyageur', () => {
    expect(parcelWithTraveler(bid({ status: 'IN_TRANSIT' }))).toBe(true)
    expect(parcelWithTraveler(bid())).toBe(false)
  })

  it('effet argent de l’annulation, selon le paiement', () => {
    expect(cancelMoneyEffect(bid())).toBe('L’expéditeur sera remboursé de 48,00 EUR ; aucun versement au voyageur.')
    expect(cancelMoneyEffect(bid({ money: money({ refundedCents: 800 }) }))).toContain('40,00 EUR')
    expect(cancelMoneyEffect(bid({ money: money({ status: 'PENDING' }) }))).toContain('autorisation de la carte est levée')
    expect(cancelMoneyEffect(bid({ money: money({ status: 'REFUNDED' }) }))).toContain('Aucun montant à rembourser')
    expect(cancelMoneyEffect(bid({ money: null }))).toContain('Aucun paiement en ligne')
    expect(cancelMoneyEffect(bid({ paymentMethod: 'CASH', money: null }))).toContain('espèces')
    expect(cancelMoneyEffect(bid({ money: money({ currency: null }) }))).toBe('L’expéditeur sera remboursé de 48,00 ; aucun versement au voyageur.')
  })

  it('effet argent du litige', () => {
    expect(disputeMoneyEffect(bid())).toBe('Le versement au voyageur (42,24 EUR net) est gelé jusqu’à la résolution du litige dans Incidents.')
    expect(disputeMoneyEffect(bid({ money: null }))).toContain('Aucun argent en séquestre')
  })

  it('erreurs traduites par code, 403, 422, endpoint absent, repli', () => {
    expect(cancelErrorMessage(err(409, 'bid-delivered'))).toBe('Colis déjà livré : il ne peut plus être annulé.')
    expect(cancelErrorMessage(err(409, 'payment-released'))).toContain('déjà été payé')
    expect(cancelErrorMessage(err(422, 'cancel-note-required'))).toContain('10 caractères')
    expect(cancelErrorMessage(err(403))).toBe('Action réservée aux super-administrateurs.')
    expect(cancelErrorMessage(err(422))).toContain('Formulaire incomplet')
    expect(cancelErrorMessage(err(404))).toBe(BID_ACTION_UNAVAILABLE)
    expect(cancelErrorMessage(err(405))).toBe(BID_ACTION_UNAVAILABLE)
    expect(cancelErrorMessage(err(404, 'bid-not-found'))).toBe('Colis introuvable.')
    expect(cancelErrorMessage(err(500, undefined, 'Panne'))).toBe('Panne')
    expect(cancelErrorMessage(undefined)).toBe('Annulation impossible pour le moment.')
    expect(disputeErrorMessage(err(409, 'payment-already-released'))).toContain('ne peut plus geler')
    expect(disputeErrorMessage(err(409, 'dispute-already-open'))).toContain('déjà ouvert')
    expect(disputeErrorMessage(undefined)).toBe('Ouverture du litige impossible pour le moment.')
  })

  it('messages de succès', () => {
    const r = { bidId: 'b', status: 'CANCELLED', previousStatus: 'ACCEPTED', alreadyCancelled: false, refundRequested: true,
      paymentStatus: 'ESCROW', refundAmount: 48, currency: 'EUR', parcelWithTraveler: false }
    expect(cancelSuccessMessage(r)).toBe('Colis annulé. Remboursement de 48,00 EUR lancé pour l’expéditeur. Les deux parties sont prévenues.')
    expect(cancelSuccessMessage({ ...r, refundAmount: 0 })).toContain('Autorisation de la carte levée.')
    expect(cancelSuccessMessage({ ...r, refundRequested: false, parcelWithTraveler: true })).toContain('organisez son retour')
    expect(cancelSuccessMessage({ ...r, currency: null })).toContain('48,00 lancé')
    expect(cancelSuccessMessage({ ...r, alreadyCancelled: true, refundRequested: false })).toBe('Ce colis était déjà annulé : rien n’a été refait.')
    expect(cancelSuccessMessage({ ...r, alreadyCancelled: true })).toBe('Ce colis était déjà annulé : le remboursement de l’expéditeur a été relancé.')
    const d = { disputeId: 'd', bidId: 'b', type: 'ADMIN_PARCEL_LOST', status: 'OPEN', openedOnBehalfOf: 'SENDER' as const, payoutFrozen: true, paymentStatus: 'ESCROW' }
    expect(disputeSuccessMessage(d)).toContain('gelé')
    expect(disputeSuccessMessage({ ...d, payoutFrozen: false })).toBe('Litige ouvert. Les deux parties sont prévenues.')
  })
})
