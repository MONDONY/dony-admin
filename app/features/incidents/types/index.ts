export type DisputeStatus = 'OPEN' | 'RESOLVED'
export type DisputeResolution = 'RESOLVED_FOR_SENDER' | 'RESOLVED_FOR_TRAVELER' | 'GUARANTEE_PAID' | 'DISMISSED' | 'SPLIT'
export type DisputeStatusFilter = 'TOUS' | DisputeStatus

export interface AdminDisputeListItem {
  id: string; bidId: string; type: string; status: DisputeStatus
  senderName: string | null; travelerName: string | null; refundFrozen: boolean; createdAt: string
}
export interface AdminDisputeDetail extends AdminDisputeListItem {
  resolution: DisputeResolution | null; resolvedAt: string | null; resolutionNote: string | null
  beneficiaryUserId: string | null
  /** Parties du litige, pour désigner le bénéficiaire d'un fonds de garantie. */
  senderId?: string | null; travelerId?: string | null
  /** Devise du colis (bid) : celle du fonds de garantie. Absente sans bid ou backend pas encore déployé. */
  bidCurrency?: string | null
  /** Versement fonds de garantie déjà fait, sinon null. */
  guaranteeAmountCents?: number | null; guaranteeCurrency?: string | null
  /** Partage chiffré décidé (FLUTTER-E2), en unité principale de la devise. Absent sur un back antérieur. */
  senderRefundAmount?: number | null; travelerPayoutAmount?: number | null; splitCurrency?: string | null
  /** Exécution du partage chez Stripe, null sans partage. */
  split?: AdminDisputeSplit | null
}

export type DisputeSplitStatus = 'CLAIMED' | 'SENDER_REFUNDED' | 'COMPLETED'
export interface AdminDisputeSplit {
  id: string; senderRefundAmount: number; travelerPayoutAmount: number; currency: string
  mode: 'REFUND_TRANSFER' | 'PARTIAL_CAPTURE'; status: DisputeSplitStatus; attempts: number
  lastError: string | null; stripeRefundId: string | null; stripeTransferId: string | null; completedAt: string | null
}

/** `GET /admin/disputes/{id}/split-options` : ce qui peut être réparti sur le colis du litige. */
export interface AdminDisputeSplitOptions {
  splittable: boolean
  /** Code de refus RFC 7807 quand `splittable` est faux (espèces, mobile money, hors séquestre…). */
  reasonCode: string | null
  currency: string | null; amount: number | null; commission: number | null
  refunded: number | null; netAvailable: number | null; rail: string | null; paymentStatus: string | null
}

/** Raison lisible d'un partage impossible. */
export const SPLIT_REFUSAL_LABELS: Record<string, string> = {
  'split-not-applicable-cash': 'Envoi payé en espèces : Yadony ne détient pas le prix du transport.',
  'split-mobile-money-unsupported': 'Paiement mobile money : partage non pris en charge, utilisez le remboursement ou la libération intégrale.',
  'split-legacy-unsupported': 'Paiement carte ancien modèle : partage non pris en charge.',
  'payment-not-in-escrow': "Le paiement n'est plus en séquestre.",
  'payment-disputed': 'Chargeback en cours sur ce paiement.',
  'split-already-exists': 'Un partage existe déjà pour ce paiement.',
  'split-nothing-available': 'Aucun net restant à répartir.',
  'split-no-payment': 'Aucun paiement rattaché à ce colis.',
  'split-no-bid': 'Litige sans colis.',
  'dispute-already-resolved': 'Litige déjà résolu.',
}

/** Unités décimales de la devise (franc CFA sans centimes). */
export function currencyDecimals(currency?: string | null): number {
  const c = (currency ?? 'EUR').toUpperCase()
  return c === 'XOF' || c === 'XAF' ? 0 : 2
}
export interface AdminDisputePage { content: AdminDisputeListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export const GUARANTEE_FUND_MAX_CENTS = 20000

/**
 * Plafond du fonds de garantie (200 euros) à l'échelle de la devise du colis, en centièmes de
 * l'unité principale. Saisi « en euros » quelle que soit la devise, le plafond bloquait tout
 * versement réaliste en franc CFA (200 XOF valent 0,30 euro). Barème indicatif, le backend
 * ne plafonne pas.
 */
const UNITS_PER_EUR: Record<string, number> = { EUR: 1, USD: 1.08, CAD: 1.47, GBP: 0.85, CHF: 0.94, XOF: 655.957, XAF: 655.957 }
export function guaranteeFundMaxCents(currency?: string | null): number {
  const rate = UNITS_PER_EUR[(currency ?? 'EUR').toUpperCase()] ?? 1
  return Math.round(GUARANTEE_FUND_MAX_CENTS * rate)
}

// ---------------------------------------------------------------------------
// No-shows (GET /admin/cancellations, dony-back feature/admin-noshows-arbitrage)
// ---------------------------------------------------------------------------

export type NoShowStatus = 'PENDING_CONFIRMATION' | 'CONTESTED' | 'CONFIRMED' | 'RESOLVED'
export type NoShowStatusFilter = NoShowStatus | 'ALL'
/** HANDOVER = absence au départ (remise du colis), DELIVERY = absence à l'arrivée (livraison). */
export type NoShowScope = 'HANDOVER' | 'DELIVERY'
export type NoShowScopeFilter = NoShowScope | 'ALL'
export type NoShowReason = 'SENDER_NO_SHOW' | 'RECIPIENT_NO_SHOW' | 'TRAVELER_DELIVERY_NO_SHOW'
export type NoShowPartyRole = 'SENDER' | 'TRAVELER' | 'RECIPIENT'
/** Décision d'un administrateur ; un rejet donne status=RESOLVED. */
export type NoShowAdminDecision = 'CONFIRMED' | 'REJECTED'

export interface NoShowParty { userId?: string | null; name?: string | null; role: NoShowPartyRole }
export interface NoShowTrip { departureCity?: string | null; arrivalCity?: string | null; departureDate?: string | null }

/** Ligne telle que le back la renvoie (champs nuls omis). */
export interface AdminNoShowRaw {
  id: string; bidId: string
  scope?: NoShowScope | null
  reason: NoShowReason | (string & {})
  status?: NoShowStatus | null
  contestationDeadline?: string | null
  remainingMinutes?: number | null
  createdAt: string
  declarant?: NoShowParty | null
  accused?: NoShowParty | null
  trip?: NoShowTrip | null
  handoverAt?: string | null
  /** Prix du colis en unités principales de `currency`. */
  amount?: number | null
  currency?: string | null
  paymentMethod?: string | null
  paymentStatus?: string | null
  bidStatus?: string | null
  dispute?: { id: string; status: string } | null
  canConfirm?: boolean | null
  canReject?: boolean | null
  /** Statut de la commission (remise en espèces), `amount` est alors nul. */
  commissionStatus?: string | null
  adminDecision?: NoShowAdminDecision | null
  decidedAt?: string | null
  /** Motif interne de l'administrateur, jamais envoyé aux parties. */
  decisionReason?: string | null
  /** Ancien back : UUID de l'auteur et statut sous un autre nom, rien d'autre. */
  cancelledBy?: string | null
  noShowStatus?: NoShowStatus | null
}

/** Ligne normalisée pour l'écran : `legacy` = ancien back (ni portée, ni noms, ni décision de rejet). */
export interface AdminNoShow {
  id: string; bidId: string
  legacy: boolean
  scope: NoShowScope | null
  reason: string
  status: NoShowStatus
  contestationDeadline: string | null
  remainingMinutes: number | null
  createdAt: string
  declarant: NoShowParty | null
  accused: NoShowParty | null
  trip: NoShowTrip | null
  handoverAt: string | null
  amount: number | null
  currency: string | null
  paymentMethod: string | null
  paymentStatus: string | null
  bidStatus: string | null
  dispute: { id: string; status: string } | null
  canConfirm: boolean
  canReject: boolean
  commissionStatus: string | null
  adminDecision: NoShowAdminDecision | null
  decidedAt: string | null
  decisionReason: string | null
}

export interface AdminNoShowPageRaw { content: AdminNoShowRaw[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminNoShowPage { content: AdminNoShow[]; totalElements: number; totalPages: number; number: number; size: number }
export interface NoShowFilters { status: NoShowStatusFilter; scope: NoShowScopeFilter }
export type NoShowDecision = 'confirm' | 'reject'
/** `disputePending` : confirmé à l'arrivée, le litige n'existe pas encore (créé après la réponse). */
export type NoShowDecisionResult = { ok: true; message: string; disputePending?: boolean } | { ok: false; message: string; code: string | null }
export const NOSHOW_REASON_MIN = 10
export const NOSHOW_REASON_MAX = 500
/** Signature de l'action « trancher » passée au panneau de détail. */
// Paramètres nommés d'un type de fonction : le no-unused-vars de base les prend pour des variables.
// eslint-disable-next-line no-unused-vars
export type NoShowDecideFn = (decision: NoShowDecision, reason: string) => Promise<NoShowDecisionResult>
