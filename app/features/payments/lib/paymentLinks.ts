import {
  alertRoute, auditRoute, bidRoute, chargebackRoute, conversationRoute, disputeRoute, gate, noShowRoute, packageRequestRoute,
  supportOfRoute, tripBidsRoute, tripRoute, userRoute, type AdminRoute, type CanFn,
} from '@/lib/adminLinks'
import type { AdminPaymentDetail } from '@/features/payments/types/index'

/** Alerte ouverte du paiement, avec sa route vers la page Alertes (ALERT_VIEW). */
export interface PaymentAlertLink { id: string; type: string; severity: string; to: AdminRoute }

/**
 * Tous les liens sortants de la fiche paiement. Chaque entrée est une route du registre, ou `null`
 * quand la permission de la destination manque ou que l'identifiant n'existe pas (ancien back,
 * négociation sans colis, compte supprimé) : l'appelant rend alors du texte, jamais un `<a>`.
 */
export interface PaymentLinkSet {
  sender: AdminRoute | null
  traveler: AdminRoute | null
  /** Argent du voyageur (fiche, onglet Argent) : USER_VIEW + PAYMENT_VIEW. */
  travelerMoney: AdminRoute | null
  senderSupport: AdminRoute | null
  travelerSupport: AdminRoute | null
  bid: AdminRoute | null
  bidTracking: AdminRoute | null
  bidMoney: AdminRoute | null
  bidIncidents: AdminRoute | null
  bidChat: AdminRoute | null
  trip: AdminRoute | null
  tripBids: AdminRoute | null
  packageRequest: AdminRoute | null
  dispute: AdminRoute | null
  noShow: AdminRoute | null
  conversation: AdminRoute | null
  chargeback: AdminRoute | null
  alerts: PaymentAlertLink[]
  audit: AdminRoute | null
  /** Cause de la retenue : fiche du voyageur, onglet Gestion (banni) ou Identité (KYC révoqué). */
  holdCause: AdminRoute | null
}

/**
 * Identifiants repris tels que le back les donne : contexte (`insight`), bloc `links` (filtré par
 * permission côté back), champs de la ligne à défaut. Aucun n'est déduit ni inventé ici.
 */
export function paymentLinks(payment: AdminPaymentDetail, can: CanFn): PaymentLinkSet {
  const insight = payment.insight ?? null
  const links = payment.links ?? {}
  const senderId = insight?.sender?.id
  const travelerId = insight?.traveler?.id ?? payment.travelerId
  const bidId = insight?.bidId ?? payment.bidId
  const announcementId = links.announcementId ?? payment.announcementId
  const bidView = (route: AdminRoute | null) => gate(can, 'BID_VIEW', route)

  let holdCause: AdminRoute | null = null
  if (payment.beneficiaryHoldReason === 'BANNED') holdCause = gate(can, 'USER_VIEW', userRoute(travelerId, 'manage'))
  else if (payment.beneficiaryHoldReason === 'KYC_REVOKED') {
    holdCause = can('USER_KYC') ? gate(can, 'USER_VIEW', userRoute(travelerId, 'identity')) : null
  }

  const alerts: PaymentAlertLink[] = []
  if (can('ALERT_VIEW')) {
    for (const a of payment.openAlerts ?? []) {
      const to = alertRoute(a.id)
      if (to) alerts.push({ id: a.id, type: a.type, severity: a.severity, to })
    }
  }

  return {
    sender: gate(can, 'USER_VIEW', userRoute(senderId)),
    traveler: gate(can, 'USER_VIEW', userRoute(travelerId)),
    travelerMoney: can('PAYMENT_VIEW') ? gate(can, 'USER_VIEW', userRoute(travelerId, 'money')) : null,
    senderSupport: gate(can, 'SUPPORT_TICKET_VIEW', supportOfRoute(senderId)),
    travelerSupport: gate(can, 'SUPPORT_TICKET_VIEW', supportOfRoute(travelerId)),
    bid: bidView(bidRoute(bidId)),
    bidTracking: bidView(bidRoute(bidId, 'tracking')),
    bidMoney: bidView(bidRoute(bidId, 'money')),
    bidIncidents: bidView(bidRoute(bidId, 'incidents')),
    // Les échanges du colis montrent la conversation : il faut aussi le droit de modération.
    bidChat: can('MODERATION_VIEW') ? bidView(bidRoute(bidId, 'chat')) : null,
    trip: bidView(tripRoute(announcementId)),
    tripBids: bidView(tripBidsRoute(announcementId)),
    packageRequest: bidView(packageRequestRoute(links.packageRequestId)),
    dispute: gate(can, 'DISPUTE_VIEW', disputeRoute(links.disputeId)),
    noShow: gate(can, 'DISPUTE_VIEW', noShowRoute(links.cancellationId)),
    conversation: gate(can, 'MODERATION_VIEW', conversationRoute(links.conversationId)),
    chargeback: gate(can, 'PAYMENT_VIEW', chargebackRoute(links.chargebackId ?? payment.chargeback?.id)),
    alerts,
    audit: gate(can, 'AUDIT_VIEW', auditRoute('PAYMENT', payment.id)),
    holdCause,
  }
}
