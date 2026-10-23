import type { AdminBidDetail } from '../types'
import type { useAuthStore } from '@/stores/auth'

export interface BidRoute { path: string; query: Record<string, string> }
export interface BidLinks {
  payment: BidRoute | null
  dispute: BidRoute | null
  noShow: BidRoute | null
  conversation: BidRoute | null
}

/**
 * Liens sortants de la fiche colis, chacun derrière sa permission : paiement (PAYMENT_VIEW),
 * litige et absence signalée (DISPUTE_VIEW), conversation (MODERATION_VIEW). Absent : `null`.
 */
/** Signature de `auth.can` : le tiroir passe `auth.can`, les tests une fonction simple. */
export type CanFn = ReturnType<typeof useAuthStore>['can']

export function bidLinks(bid: AdminBidDetail, can: CanFn): BidLinks {
  const links = bid.links ?? null
  const money = bid.money ?? null
  return {
    payment: money && can('PAYMENT_VIEW') ? { path: '/transactions', query: { open: money.paymentId } } : null,
    dispute: links?.disputeId && can('DISPUTE_VIEW') ? { path: '/incidents', query: { open: links.disputeId } } : null,
    noShow: bid.status === 'NO_SHOW' && links?.cancellationId && can('DISPUTE_VIEW')
      ? { path: '/incidents', query: { tab: 'noshows', open: links.cancellationId } }
      : null,
    conversation: links?.conversationId && can('MODERATION_VIEW')
      ? { path: '/moderation', query: { open: links.conversationId } }
      : null,
  }
}
