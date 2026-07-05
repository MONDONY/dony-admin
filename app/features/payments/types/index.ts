export type PaymentStatus = 'PENDING' | 'ESCROW' | 'RELEASED' | 'FAILED' | 'REFUNDED' | 'CANCELLED'
export type PaymentMethod = 'STRIPE' | 'CASH' | 'WAVE' | 'ORANGE_MONEY'
export type PaymentStatusFilter = 'TOUS' | PaymentStatus
export type PaymentMethodFilter = 'TOUS' | PaymentMethod
export type ChargebackStatus = 'OPEN' | 'WON' | 'LOST'

export interface AdminPaymentListItem { id: string; bidId: string | null; status: PaymentStatus; method: PaymentMethod; amountCents: number; commissionCents: number; createdAt: string }
export interface AdminPaymentDetail extends AdminPaymentListItem { refundedCents: number; stripePaymentIntentId: string | null; escrowReleasedAt: string | null; disputed: boolean }
export interface AdminChargeback { id: string; bidId: string | null; amountCents: number; reason: string | null; status: ChargebackStatus; openedAt: string }
export interface AdminPaymentPage { content: AdminPaymentListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminChargebackPage { content: AdminChargeback[]; totalElements: number; totalPages: number; number: number; size: number }
export interface PaymentsFilterState { status: PaymentStatusFilter; method: PaymentMethodFilter; dateFrom: string | null; dateTo: string | null }
export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
