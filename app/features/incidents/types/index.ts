export type DisputeStatus = 'OPEN' | 'RESOLVED'
export type DisputeResolution = 'RESOLVED_FOR_SENDER' | 'RESOLVED_FOR_TRAVELER' | 'GUARANTEE_PAID' | 'DISMISSED'
export type NoShowStatus = 'CONFIRMED' | 'PENDING_CONFIRMATION' | 'CONTESTED'
export type DisputeStatusFilter = 'TOUS' | DisputeStatus
export type NoShowFilter = 'PENDING_CONFIRMATION' | 'CONTESTED' | 'ALL'

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
}
export interface AdminCancellation {
  id: string; bidId: string; cancelledBy: string; reason: string
  noShowStatus: NoShowStatus; contestationDeadline: string | null; createdAt: string
}
export interface AdminDisputePage { content: AdminDisputeListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminCancellationPage { content: AdminCancellation[]; totalElements: number; totalPages: number; number: number; size: number }
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
