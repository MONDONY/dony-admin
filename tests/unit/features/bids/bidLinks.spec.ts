/** Liens sortants de la fiche colis et leurs gardes de permission. */
import { describe, it, expect } from 'vitest'
import { bidLinks } from '@/features/bids/lib/bidLinks'
import type { AdminBidDetail } from '@/features/bids/types/index'

const money = { paymentId: 'pay-1', status: 'ESCROW', rail: 'STRIPE', amountCents: 1, commissionCents: 0, refundedCents: 0,
  currency: 'EUR', capturedAt: null, escrowReleasedAt: null, payoutHeldAt: null, disputed: false }
const links = { negotiationThreadId: null, disputeId: 'dsp-1', disputeStatus: 'OPEN', conversationId: 'fs-42', cancellationId: 'c-1' }
const bid = (over: Partial<AdminBidDetail> = {}) => ({ id: 'b1', status: 'NO_SHOW', money, links, ...over }) as AdminBidDetail
const all = () => true
const none = () => false

describe('bidLinks', () => {
  it('toutes les permissions : les quatre liens', () => {
    expect(bidLinks(bid(), all)).toEqual({
      payment: { path: '/transactions', query: { open: 'pay-1' } },
      dispute: { path: '/incidents', query: { open: 'dsp-1' } },
      noShow: { path: '/incidents', query: { tab: 'noshows', open: 'c-1' } },
      conversation: { path: '/moderation', query: { open: 'fs-42' } },
    })
  })

  it('chaque lien suit sa permission', () => {
    expect(bidLinks(bid(), none)).toEqual({ payment: null, dispute: null, noShow: null, conversation: null })
    const only = (p: string) => (q: string) => q === p
    expect(bidLinks(bid(), only('PAYMENT_VIEW')).payment).not.toBeNull()
    expect(bidLinks(bid(), only('PAYMENT_VIEW')).dispute).toBeNull()
    expect(bidLinks(bid(), only('DISPUTE_VIEW')).dispute).not.toBeNull()
    expect(bidLinks(bid(), only('DISPUTE_VIEW')).noShow).not.toBeNull()
    expect(bidLinks(bid(), only('MODERATION_VIEW')).conversation).not.toBeNull()
  })

  it('données absentes : pas de lien (ancien back, sans paiement, absence hors statut NO_SHOW)', () => {
    expect(bidLinks(bid({ money: undefined, links: undefined }), all))
      .toEqual({ payment: null, dispute: null, noShow: null, conversation: null })
    expect(bidLinks(bid({ status: 'ACCEPTED' }), all).noShow).toBeNull()
    const empty = bidLinks(bid({ money: null, links: { ...links, disputeId: null, conversationId: null, cancellationId: null } }), all)
    expect(empty).toEqual({ payment: null, dispute: null, noShow: null, conversation: null })
  })
})
