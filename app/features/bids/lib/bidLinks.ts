import type { AdminBidDetail } from '../types'
import type { useAuthStore } from '@/stores/auth'
import { unchecked, gate, conversationRoute, type AdminRoute } from '@/lib/adminLinks'

export type BidRoute = AdminRoute
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
    payment: money ? gate(can, 'PAYMENT_VIEW', unchecked.paymentRoute(money.paymentId)) : null,
    dispute: gate(can, 'DISPUTE_VIEW', unchecked.disputeRoute(links?.disputeId)),
    noShow: bid.status === 'NO_SHOW' ? gate(can, 'DISPUTE_VIEW', unchecked.noShowRoute(links?.cancellationId)) : null,
    conversation: gate(can, 'MODERATION_VIEW', conversationRoute(links?.conversationId)),
  }
}
