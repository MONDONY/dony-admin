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

export interface AdminPaymentListItem extends PayoutHoldFields { id: string; bidId: string | null; status: PaymentStatus; method: PaymentMethod; amountCents: number; commissionCents: number; currency: string; createdAt: string }
/**
 * Les trois identifiants pawaPay sont la DERNIÈRE opération connue de chaque type (null sur le
 * rail Stripe ou tant qu'aucune opération n'a eu lieu). Optionnels : un ancien back ne les
 * envoie pas.
 */
export interface AdminPaymentDetail extends AdminPaymentListItem {
  refundedCents: number; stripePaymentIntentId: string | null; escrowReleasedAt: string | null; disputed: boolean
  pawapayDepositId?: string | null; pawapayPayoutId?: string | null; pawapayRefundId?: string | null
}
export interface AdminChargeback { id: string; bidId: string | null; amountCents: number; currency?: string | null; reason: string | null; status: ChargebackStatus; openedAt: string }
export interface AdminPaymentPage { content: AdminPaymentListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminChargebackPage { content: AdminChargeback[]; totalElements: number; totalPages: number; number: number; size: number }
export interface PaymentsFilterState {
  status: PaymentStatusFilter; method: PaymentMethodFilter; currency: PaymentCurrencyFilter; dateFrom: string | null; dateTo: string | null
  /** « Versements retenus » : envoyé en `held=true`, jamais quand il est faux. */
  held?: boolean
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
