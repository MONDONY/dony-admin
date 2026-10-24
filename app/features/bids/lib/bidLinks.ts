import type { AdminBidDetail } from '../types'
import { unchecked, gate, conversationRoute, type AdminRoute, type CanFn } from '@/lib/adminLinks'

export type BidRoute = AdminRoute
export interface BidLinks {
  payment: BidRoute | null
  dispute: BidRoute | null
  noShow: BidRoute | null
  conversation: BidRoute | null
}

/** Signature de `auth.can` (définie par le registre) : le tiroir passe `auth.can`, les tests une fonction simple. */
export type { CanFn }

/**
 * Liens sortants de la fiche colis, chacun derrière sa permission : paiement (PAYMENT_VIEW),
 * litige et absence signalée (DISPUTE_VIEW), conversation (MODERATION_VIEW). Absent : `null`.
 */
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
