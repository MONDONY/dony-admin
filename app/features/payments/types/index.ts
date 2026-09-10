export type PaymentStatus = 'PENDING' | 'ESCROW' | 'RELEASED' | 'FAILED' | 'REFUNDED' | 'CANCELLED'
/**
 * `method` est le RAIL du paiement, tel que le backend le rend : carte (Stripe) ou mobile
 * money (pawaPay). Les anciennes valeurs `CASH`, `WAVE`, `ORANGE_MONEY` n'existaient plus
 * côté serveur : les filtrer donnait toujours une liste vide.
 */
export type PaymentMethod = 'STRIPE' | 'PAWAPAY'
export type PaymentCurrency = 'EUR' | 'USD' | 'CAD' | 'GBP' | 'CHF' | 'XOF' | 'XAF'
export type PaymentStatusFilter = 'TOUS' | PaymentStatus
export type PaymentMethodFilter = 'TOUS' | PaymentMethod
export type PaymentCurrencyFilter = 'TOUTES' | PaymentCurrency
export type ChargebackStatus = 'OPEN' | 'WON' | 'LOST'

export interface AdminPaymentListItem { id: string; bidId: string | null; status: PaymentStatus; method: PaymentMethod; amountCents: number; commissionCents: number; currency: string; createdAt: string }
export interface AdminPaymentDetail extends AdminPaymentListItem { refundedCents: number; stripePaymentIntentId: string | null; escrowReleasedAt: string | null; disputed: boolean }
export interface AdminChargeback { id: string; bidId: string | null; amountCents: number; currency?: string | null; reason: string | null; status: ChargebackStatus; openedAt: string }
export interface AdminPaymentPage { content: AdminPaymentListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminChargebackPage { content: AdminChargeback[]; totalElements: number; totalPages: number; number: number; size: number }
export interface PaymentsFilterState { status: PaymentStatusFilter; method: PaymentMethodFilter; currency: PaymentCurrencyFilter; dateFrom: string | null; dateTo: string | null }

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
