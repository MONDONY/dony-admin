/**
 * Gestes admin de la fiche colis : « Annuler le colis » (POST /admin/bids/{id}/cancel) et
 * « Ouvrir un litige » (POST /admin/bids/{id}/disputes). Réservés aux super-administrateurs
 * (ADMIN_MANAGE, comme le back). Les règles d'éligibilité ci-dessous ne font qu'éviter un clic
 * voué au refus : le back reste la source de vérité et répond 409 avec un code, traduit ici.
 */
import type { AdminBidDetail } from '@/features/bids/types/index'
import { formatMoney } from '@/features/payments/types/index'
import { problemCode, isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

export const BID_ACTION_PERMISSION = 'ADMIN_MANAGE'
export const BID_ACTION_FORBIDDEN = 'Réservé aux super-administrateurs : demandez à l’un d’eux.'
export const BID_ACTION_UNAVAILABLE = 'Action indisponible sur cet environnement : le serveur ne la propose pas encore.'

export type AdminBidCancelReason =
  | 'SENDER_REQUEST' | 'TRAVELER_REQUEST' | 'TRAVELER_UNAVAILABLE' | 'PROHIBITED_CONTENT'
  | 'FRAUD_SUSPECTED' | 'DUPLICATE' | 'TECHNICAL_ISSUE' | 'OTHER'

export const CANCEL_REASONS: readonly { value: AdminBidCancelReason; label: string }[] = [
  { value: 'SENDER_REQUEST', label: 'Demande de l’expéditeur' },
  { value: 'TRAVELER_REQUEST', label: 'Demande du voyageur' },
  { value: 'TRAVELER_UNAVAILABLE', label: 'Voyageur injoignable ou trajet abandonné' },
  { value: 'PROHIBITED_CONTENT', label: 'Contenu interdit ou non conforme' },
  { value: 'FRAUD_SUSPECTED', label: 'Suspicion de fraude' },
  { value: 'DUPLICATE', label: 'Colis en double ou créé par erreur' },
  { value: 'TECHNICAL_ISSUE', label: 'Incident technique' },
  { value: 'OTHER', label: 'Autre (à préciser)' },
]

export type AdminDisputeReason =
  | 'PARCEL_DAMAGED' | 'PARCEL_LOST' | 'PARCEL_NOT_DELIVERED' | 'CONTENT_MISMATCH'
  | 'PAYMENT_DISAGREEMENT' | 'PARTY_BEHAVIOUR' | 'OTHER'

export const DISPUTE_REASONS: readonly { value: AdminDisputeReason; label: string }[] = [
  { value: 'PARCEL_DAMAGED', label: 'Colis abîmé' },
  { value: 'PARCEL_LOST', label: 'Colis perdu' },
  { value: 'PARCEL_NOT_DELIVERED', label: 'Colis non remis au destinataire' },
  { value: 'CONTENT_MISMATCH', label: 'Contenu différent de la déclaration' },
  { value: 'PAYMENT_DISAGREEMENT', label: 'Désaccord sur le prix ou le paiement' },
  { value: 'PARTY_BEHAVIOUR', label: 'Comportement d’une des parties' },
  { value: 'OTHER', label: 'Autre' },
]

export type DisputeParty = 'SENDER' | 'TRAVELER'

/** Note interne : obligatoire (10 caractères) avec le motif « Autre », 1 000 au plus. */
export const CANCEL_NOTE_MIN = 10
export const CANCEL_NOTE_MAX = 1000
/** Description du litige : 10 à 2 000 caractères (validation du back). */
export const DISPUTE_DESCRIPTION_MIN = 10
export const DISPUTE_DESCRIPTION_MAX = 2000

export interface AdminBidCancelResult {
  bidId: string; status: string; previousStatus: string; alreadyCancelled: boolean
  refundRequested: boolean; paymentStatus: string | null; refundAmount: number; currency: string | null
  parcelWithTraveler: boolean
}
export interface AdminOpenDisputeResult {
  disputeId: string; bidId: string; type: string; status: string; openedOnBehalfOf: DisputeParty
  payoutFrozen: boolean; paymentStatus: string | null
}

const DELIVERED_OR_CLOSED = ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW', 'PARCEL_REFUSED', 'NEGOTIATION_CLOSED']
const DISPUTABLE = ['PAYMENT_ESCROWED', 'ACCEPTED', 'HANDED_OVER', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED', 'NO_SHOW', 'PARCEL_REFUSED']
const WITH_TRAVELER = ['HANDED_OVER', 'IN_TRANSIT', 'ARRIVED']

function hasOpenDispute(bid: AdminBidDetail): boolean {
  return !!bid.links?.disputeId && bid.links.disputeStatus !== 'RESOLVED'
}

/** Raison pour laquelle l'annulation est impossible, ou null si elle l'est. */
export function cancelBlockedReason(bid: AdminBidDetail): string | null {
  const s = bid.status as string
  if (s === 'CANCELLED') return 'Colis déjà annulé.'
  if (s === 'COMPLETED') return 'Colis déjà livré : il ne peut plus être annulé.'
  if (s === 'NEGOTIATING') return 'Simple discussion de prix : aucun colis réservé à annuler.'
  if (DELIVERED_OR_CLOSED.includes(s)) return 'Colis déjà terminé : rien à annuler.'
  if (bid.money?.status === 'RELEASED' || bid.money?.escrowReleasedAt) return 'Le voyageur a déjà été payé : l’annulation est impossible.'
  if (bid.money?.disputed) return 'Litige bancaire en cours sur ce paiement : attendez la décision de la banque.'
  if (hasOpenDispute(bid)) return 'Un litige est ouvert sur ce colis : résolvez-le d’abord dans Incidents.'
  return null
}

/** Raison pour laquelle l'ouverture d'un litige est impossible, ou null si elle l'est. */
export function disputeBlockedReason(bid: AdminBidDetail): string | null {
  if (hasOpenDispute(bid)) return 'Un litige est déjà ouvert sur ce colis.'
  if (!DISPUTABLE.includes(bid.status as string)) return 'Aucune transaction engagée sur ce colis : pas de litige possible.'
  if (bid.money?.status === 'RELEASED' || bid.money?.escrowReleasedAt) {
    return 'Le voyageur a déjà été payé : un litige ne peut plus geler l’argent. Passez par le support ou un remboursement manuel.'
  }
  return null
}

export function parcelWithTraveler(bid: AdminBidDetail): boolean {
  return WITH_TRAVELER.includes(bid.status as string)
}

/** Ce que l'annulation fait de l'argent, à confirmer explicitement avant l'envoi. */
export function cancelMoneyEffect(bid: AdminBidDetail): string {
  const m = bid.money
  if (bid.paymentMethod === 'CASH') {
    return 'Paiement en espèces : aucun paiement en ligne à rembourser (une commission déjà prélevée est rendue). Aucun versement au voyageur.'
  }
  if (!m) return 'Aucun paiement en ligne enregistré : rien à rembourser. Aucun versement au voyageur.'
  if (m.status === 'ESCROW') {
    const due = Math.max(0, m.amountCents - (m.refundedCents ?? 0))
    return `L’expéditeur sera remboursé de ${formatMoney(due, m.currency ?? undefined)} ; aucun versement au voyageur.`
  }
  if (m.status === 'PENDING') {
    return 'Le paiement n’a pas été confirmé : l’autorisation de la carte est levée, rien n’est débité. Aucun versement au voyageur.'
  }
  return 'Aucun montant à rembourser (paiement déjà remboursé ou annulé). Aucun versement au voyageur.'
}

/** Ce que l'ouverture du litige fait de l'argent. */
export function disputeMoneyEffect(bid: AdminBidDetail): string {
  const m = bid.money
  if (m?.status === 'ESCROW') {
    return `Le versement au voyageur (${formatMoney(Math.max(0, m.amountCents - m.commissionCents), m.currency ?? undefined)} net) est gelé jusqu’à la résolution du litige dans Incidents.`
  }
  return 'Aucun argent en séquestre à geler : le litige trace le différend, les deux parties sont prévenues.'
}

const CANCEL_ERRORS: Record<string, string> = {
  'bid-not-found': 'Colis introuvable.',
  'bid-delivered': 'Colis déjà livré : il ne peut plus être annulé.',
  'bid-already-closed': 'Colis déjà terminé : rien à annuler.',
  'bid-not-a-parcel': 'Simple discussion de prix : aucun colis réservé à annuler.',
  'payment-released': 'Le voyageur a déjà été payé pour ce colis : l’annulation est impossible.',
  'payment-disputed': 'Litige bancaire en cours sur ce paiement : attendez la décision de la banque.',
  'dispute-open': 'Un litige est ouvert sur ce colis : résolvez-le d’abord dans Incidents.',
  'cancel-note-required': 'Précisez le motif « Autre » en 10 caractères au moins.',
}

const DISPUTE_ERRORS: Record<string, string> = {
  'bid-not-found': 'Colis introuvable.',
  'bid-not-disputable': 'Aucune transaction engagée sur ce colis : pas de litige possible.',
  'dispute-already-open': 'Un litige est déjà ouvert sur ce colis : suivez-le dans Incidents.',
  'dispute-already-exists': 'Un litige pour ce motif a déjà été traité sur ce colis : choisissez un autre motif.',
  'payment-already-released': 'Le voyageur a déjà été payé : un litige ne peut plus geler l’argent. Passez par le support ou un remboursement manuel.',
  'traveler-not-found': 'Le trajet de ce colis n’existe plus : voyageur introuvable.',
}

function statusOf(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

function errorMessage(e: unknown, table: Record<string, string>, fallback: string): string {
  if (isEndpointMissing(e)) return BID_ACTION_UNAVAILABLE
  const status = statusOf(e)
  if (status === 403) return 'Action réservée aux super-administrateurs.'
  const code = problemCode(e)
  if (code && table[code]) return table[code]
  if (status === 422) return 'Formulaire incomplet : vérifiez le motif et le texte saisi.'
  return extractProblemMessage(e, fallback)
}

export function cancelErrorMessage(e: unknown): string {
  return errorMessage(e, CANCEL_ERRORS, 'Annulation impossible pour le moment.')
}

export function disputeErrorMessage(e: unknown): string {
  return errorMessage(e, DISPUTE_ERRORS, 'Ouverture du litige impossible pour le moment.')
}

/** Message de succès, affiché sur la fiche rechargée. */
export function cancelSuccessMessage(r: AdminBidCancelResult): string {
  if (r.alreadyCancelled) return 'Ce colis était déjà annulé : rien n’a été refait.'
  const parts = ['Colis annulé.']
  if (r.refundRequested && r.refundAmount > 0) {
    parts.push(`Remboursement de ${formatMoney(Math.round(r.refundAmount * 100), r.currency ?? undefined)} lancé pour l’expéditeur.`)
  } else if (r.refundRequested) {
    parts.push('Autorisation de la carte levée.')
  }
  if (r.parcelWithTraveler) parts.push('Le colis est chez le voyageur : organisez son retour avec le support.')
  parts.push('Les deux parties sont prévenues.')
  return parts.join(' ')
}

export function disputeSuccessMessage(r: AdminOpenDisputeResult): string {
  return r.payoutFrozen
    ? 'Litige ouvert : le versement au voyageur est gelé. Les deux parties sont prévenues.'
    : 'Litige ouvert. Les deux parties sont prévenues.'
}
