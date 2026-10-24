export type PaymentStatus = 'PENDING' | 'ESCROW' | 'RELEASED' | 'FAILED' | 'REFUNDED' | 'CANCELLED'
/**
 * `method` est le RAIL du paiement, tel que le backend le rend : carte (Stripe) ou mobile
 * money (pawaPay). Les anciennes valeurs `CASH`, `WAVE`, `ORANGE_MONEY` n'existaient plus
 * côté serveur : les filtrer donnait toujours une liste vide.
 */
export type PaymentMethod = 'STRIPE' | 'PAWAPAY'
export type PaymentCurrency = 'EUR' | 'USD' | 'CAD' | 'GBP' | 'CHF' | 'XOF' | 'XAF'
/** Les devises que la plateforme sait encaisser, dans l'ordre d'affichage des filtres. */
export const PAYMENT_CURRENCIES: readonly PaymentCurrency[] = ['EUR', 'USD', 'CAD', 'GBP', 'CHF', 'XOF', 'XAF']
export type PaymentStatusFilter = 'TOUS' | PaymentStatus
export type PaymentMethodFilter = 'TOUS' | PaymentMethod
export type PaymentCurrencyFilter = 'TOUTES' | PaymentCurrency
export type ChargebackStatus = 'OPEN' | 'WON' | 'LOST'

/** Pourquoi les versements du voyageur sont retenus : compte banni ou identité révoquée. */
export type PayoutHoldReason = 'BANNED' | 'KYC_REVOKED'

/**
 * Champs de retenue du versement (nouveau back, NON_NULL) : tous optionnels, un ancien back
 * n'en envoie aucun et rien de plus ne s'affiche. `payoutHeldAt` date la retenue effective ;
 * `beneficiaryHeld` dit que le voyageur est gelé au moment de la lecture. `travelerId`, s'il
 * est fourni, sert au lien vers la fiche du voyageur.
 */
export interface PayoutHoldFields {
  payoutHeldAt?: string | null
  beneficiaryHeld?: boolean
  beneficiaryHoldReason?: PayoutHoldReason | null
  travelerId?: string | null
}

/** Une partie au paiement (expéditeur ou voyageur) ; `name` absent si le compte n'a ni nom ni pseudo. */
export interface PaymentParty { id: string; name: string | null }

/**
 * Contexte calculé par le back : colis classique (`BID`) ou négociation (`NEGOTIATION`), parties,
 * trajet, références Stripe. Un paiement de négociation garde `bidId` vide sur la ligne même
 * après la création du colis : `insight.bidId` est le colis résolu. Absent d'un ancien back.
 */
export interface PaymentInsight {
  kind: 'BID' | 'NEGOTIATION'
  bidId: string | null
  negotiationThreadId: string | null
  sender: PaymentParty | null
  traveler: PaymentParty | null
  departureCity: string | null
  arrivalCity: string | null
  bidStatus: string | null
  /** Checkout jamais terminé : en attente depuis plus de 24 h. */
  abandoned: boolean
  netTravelerCents: number
  capturedAt: string | null
  fxExchangeRate: number | null
  stripeChargeId: string | null
  stripeDashboardUrl: string | null
}

/** Vues de la liste des paiements (nombres de pastilles). `ALL` est la vue sans restriction. */
export type PaymentView = 'ATTENTION' | 'ESCROW' | 'RELEASED_RECENT' | 'REFUNDED' | 'FAILED' | 'ALL'

/** Alertes d'un paiement, de la plus urgente à la moins urgente. */
export type PaymentAlertCode = 'HELD' | 'CHARGEBACK_OPEN' | 'MM_FAILED' | 'ESCROW_J48'

/**
 * Nombres par vue (`GET /admin/payments/counts`). `attention` = paiements portant AU MOINS UNE
 * alerte. Les `alerts` sont les prédicats bruts : NON exclusifs, ils peuvent se recouper, leur
 * somme n'égale donc pas forcément `attention`. `abandoned` compte les checkouts abandonnés du
 * périmètre même quand `hideAbandoned` les masque (c'est le nombre du lien « les afficher »).
 */
export interface PaymentViewCounts {
  attention: number; escrow: number; releasedRecent: number; refunded: number; failed: number; all: number; abandoned: number
  alerts: { held: number; chargebackOpen: number; mmFailed: number; escrowJ48: number }
}

/** Personne proposée par la recherche (expéditeur ou voyageur) ; `count` = ses paiements. */
export interface PaymentSuggestPerson { id: string; name: string; count: number }
export interface PaymentSuggestTrip { label: string; departureCity: string; arrivalCity: string; count: number }
export interface PaymentSuggestParcel { paymentId: string; trackingNumber: string; status: string; amountCents: number; currency: string }

/** Propositions de la recherche, cinq au plus par groupe. Jamais de numéro de téléphone. */
export interface PaymentSuggest {
  /** Présent quand la saisie identifie exactement un paiement. */
  exactPaymentId?: string
  senders: PaymentSuggestPerson[]
  travelers: PaymentSuggestPerson[]
  trips: PaymentSuggestTrip[]
  parcels: PaymentSuggestParcel[]
}

export interface AdminPaymentListItem extends PayoutHoldFields {
  id: string; bidId: string | null; status: PaymentStatus; method: PaymentMethod; amountCents: number; commissionCents: number; currency: string; createdAt: string
  insight?: PaymentInsight | null
  /** Alerte la plus urgente du paiement ; absente s'il n'y en a aucune (ou ancien back). */
  alert?: PaymentAlertCode | null
  /** N° de suivi du colis (direct ou lié au fil) ; absent si aucun colis. */
  trackingNumber?: string | null
  /** Annonce du trajet ; absente tant que le fil n'a pas de colis. */
  announcementId?: string | null
}

/**
 * Fiches liées au paiement. Chaque identifiant n'est renvoyé que si l'opérateur a la permission
 * de sa destination ; bloc entier absent quand aucun n'est visible.
 */
export interface PaymentLinks {
  announcementId?: string; disputeId?: string; disputeStatus?: string; cancellationId?: string
  conversationId?: string; chargebackId?: string; packageRequestId?: string
}
/** Alerte non résolue qui cite le paiement (visible avec ALERT_VIEW). */
export interface PaymentOpenAlert { id: string; type: string; severity: string }
/** Litige bancaire le plus récent du paiement. */
export interface PaymentChargebackSummary { id: string; status: string; reason?: string; outcome?: string; openedAt?: string }

/** Totaux d'une devise sur le périmètre filtré (centimes). */
export interface PaymentTotals {
  currency: string; count: number; escrowCents: number; releasedCents: number; refundedCents: number; commissionCents: number; pendingCount: number
}

/** Étape de la chronologie : date portée par le paiement (`PAYMENT`) ou entrée du journal (`AUDIT`). */
export interface PaymentTimelineEntry {
  at: string; action: string; source: 'PAYMENT' | 'AUDIT'
  actorId: string | null; actorKind: 'ADMIN' | 'USER' | null; actorLabel: string | null
  payload: Record<string, unknown>
}
/**
 * Les trois identifiants pawaPay sont la DERNIÈRE opération connue de chaque type (null sur le
 * rail Stripe ou tant qu'aucune opération n'a eu lieu). Optionnels : un ancien back ne les
 * envoie pas.
 */
export interface AdminPaymentDetail extends AdminPaymentListItem {
  /** Fiches liées filtrées par permission (ancien back : absent). */
  links?: PaymentLinks
  /** Alertes ouvertes du paiement ; absentes sans ALERT_VIEW. */
  openAlerts?: PaymentOpenAlert[]
  chargeback?: PaymentChargebackSummary
  refundedCents: number; stripePaymentIntentId: string | null; escrowReleasedAt: string | null; disputed: boolean
  pawapayDepositId?: string | null; pawapayPayoutId?: string | null; pawapayRefundId?: string | null
  /**
   * Capture carte enregistrée en base (back #487) ; null si jamais encaissé. Absent d'un ancien
   * back : rien ne s'affiche alors, plutôt qu'un « Non encaissé » faux.
   */
  capturedAt?: string | null
  /** Fil de négociation du paiement (back #487) ; absent d'un ancien back. */
  negotiationThreadId?: string | null
}

/** Ce que la resynchronisation Stripe a fait (`POST /admin/payments/{id}/resync-stripe`). */
export type StripeResyncAction =
  | 'ALREADY_IN_SYNC' | 'ESCROW_ACTIVATED' | 'ESCROW_CAPTURED' | 'CAPTURE_RECORDED' | 'MARKED_FAILED' | 'MARKED_CANCELLED'
  | 'ESCROW_RELEASED'

/** État base + Stripe d'un paiement, avant ou après la resynchronisation. */
export interface StripeResyncState {
  status: string | null
  capturedAt: string | null
  stripeStatus: string | null
  /** Unités mineures de la devise du paiement. */
  amountCapturable: number | null
}

export interface StripeResyncResult {
  paymentId: string
  paymentIntentId: string | null
  action: StripeResyncAction | string
  changed: boolean
  before: StripeResyncState
  after: StripeResyncState
  message: string | null
  /** Alertes du paiement résolues automatiquement par cette resynchronisation. */
  resolvedAlertIds: string[]
  /** Alertes du paiement encore ouvertes (écart d'une autre nature). */
  openAlertIds: string[]
  /** Vrai s'il reste des alertes que l'admin peut clore lui-même maintenant que la base est alignée. */
  alertResolvable: boolean
  /** Back #488 : le versement au voyageur est parti pendant la resynchronisation (colis déjà livré). Absent sur l'ancien back. */
  released?: boolean
}
export interface AdminChargeback {
  id: string; bidId: string | null; amountCents: number; currency?: string | null; reason: string | null; status: ChargebackStatus; openedAt: string
  /** Nouveau back : paiement du litige (à défaut celui du colis), colis, trajet et parties. Un nom manque pour un compte supprimé. */
  paymentId?: string | null; trackingNumber?: string | null; corridor?: string | null
  senderId?: string | null; senderName?: string | null; travelerId?: string | null; travelerName?: string | null
  /** Issue et date de décision, seulement une fois le litige tranché. */
  outcome?: string | null; resolvedAt?: string | null
}
/** Vues de la liste des litiges bancaires. */
export type ChargebackView = 'ALL' | 'OPEN' | 'WON' | 'LOST'
export interface ChargebackCounts { open: number; won: number; lost: number; all: number }
export interface ChargebackListParams { view?: ChargebackView; q?: string; page?: number; size?: number }
export interface AdminPaymentPage { content: AdminPaymentListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminChargebackPage { content: AdminChargeback[]; totalElements: number; totalPages: number; number: number; size: number }
export interface PaymentsFilterState {
  status: PaymentStatusFilter; method: PaymentMethodFilter; currency: PaymentCurrencyFilter; dateFrom: string | null; dateTo: string | null
  /** « Versements retenus » : envoyé en `held=true`, jamais quand il est faux. */
  held?: boolean
  /** Recherche libre : identifiant, référence Stripe (pi_…), nom ou pseudo d'une partie. */
  query?: string
  /** Masque les checkouts abandonnés (en attente depuis plus de 24 h). */
  hideAbandoned?: boolean
  /** Vue (pastille) ; `ALL` ou absent = sans restriction, non envoyé. */
  view?: PaymentView
  /** Alerte précise ; vide ou absente = non envoyé. */
  alert?: PaymentAlertCode | null
  /** Expéditeur OU voyageur ; vide = non envoyé. */
  partyId?: string
  announcementId?: string
  bidId?: string
  /** Bornes de montant en CENTIMES (incluses) ; `null` ou absent = non envoyé. */
  amountMin?: number | null
  amountMax?: number | null
}

/** Corps d'une dérogation : payer le voyageur malgré le blocage, motif journalisé côté back. */
export interface PayoutOverride { overrideHold: true; overrideReason: string }
export const PAYOUT_OVERRIDE_REASON_MIN = 10
export const PAYOUT_OVERRIDE_REASON_MAX = 500
export function overrideReasonValid(reason: string): boolean {
  const n = reason.trim().length
  return n >= PAYOUT_OVERRIDE_REASON_MIN && n <= PAYOUT_OVERRIDE_REASON_MAX
}

/** Les deux gestes qui paient le voyageur, donc les seuls à pouvoir exiger une dérogation. */
export type PayoutAction = 'release' | 'retry-payout'
/** Codes 409 du back qui se lèvent par une dérogation motivée. */
export const OVERRIDABLE_CONFLICT_CODES = ['payout-beneficiary-held', 'payment-disputed'] as const
/** Compte Stripe du voyageur inutilisable : aucune dérogation n'y peut rien. */
export const STRIPE_ACCOUNT_UNUSABLE = 'stripe-account-unusable'
/** Force-release : un transfert Stripe a déjà été tenté, le relancer risquerait de payer deux fois. */
export const TRANSFER_ALREADY_ATTEMPTED = 'transfer-already-attempted'
/** 422 : motif de dérogation hors 10 à 500 caractères après trim, montré dans le dialogue. */
export const OVERRIDE_REASON_INVALID = 'override-reason-invalid'
/** Blocages que le 409 énumère dans `blockers` ; ils peuvent coexister. */
export type PayoutBlocker = 'DISPUTED' | 'BENEFICIARY_HELD'

export function stripeAccountStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return ({ DISABLED: 'désactivé', REJECTED: 'refusé' } as Record<string, string>)[status] ?? status
}

/** « compte banni et identité révoquée » ; null sans motif connu. */
export function holdReasonsLabel(reasons: readonly (string | null | undefined)[]): string | null {
  const labels = reasons.map(holdReasonLabel).filter((l): l is string => Boolean(l))
  return labels.length ? labels.join(' et ') : null
}

export function isPaymentHeld(p: PayoutHoldFields): boolean {
  return p.beneficiaryHeld === true || p.payoutHeldAt != null
}

export function holdReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  return ({ BANNED: 'compte banni', KYC_REVOKED: 'identité révoquée' } as Record<string, string>)[reason] ?? reason
}

/** Montant sans devise connue. Un paiement ou un litige bancaire porte sa devise : voir `formatMoney`. */
export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

/**
 * Montant d'un paiement dans SA devise. Centièmes de l'unité principale quelle que soit la
 * devise, convention du back-office : 660000 XOF -> « 6 600,00 XOF ».
 */
/**
 * Montant dans sa devise (« 6 600,00 XOF »). Sans devise (backend pas encore déployé), le
 * montant sort nu plutôt qu'en euros : mieux vaut aucun libellé qu'un libellé faux.
 */
export function formatMoney(cents: number, currency?: string): string {
  const amount = (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? amount + ' ' + currency : amount
}

export function paymentMethodLabel(method: string): string {
  return { STRIPE: 'Carte', PAWAPAY: 'Mobile money' }[method] ?? method
}

/** Rappel au moment de rétablir un compte : les paiements retenus ne repartent jamais seuls. */
export function heldPaymentsReminder(n: number): string {
  return n > 1
    ? `Ce voyageur a ${n} paiements retenus : ils ne repartiront pas tout seuls, débloquez-les un par un depuis Transactions.`
    : `Ce voyageur a ${n} paiement retenu : il ne repartira pas tout seul, débloquez-le depuis Transactions.`
}
