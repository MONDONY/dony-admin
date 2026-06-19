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
  declaredValueEur: number; beneficiaryUserId: string | null
}
export interface AdminCancellation {
  id: string; bidId: string; cancelledBy: string; reason: string
  noShowStatus: NoShowStatus; contestationDeadline: string | null; createdAt: string
}
export interface AdminDisputePage { content: AdminDisputeListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminCancellationPage { content: AdminCancellation[]; totalElements: number; totalPages: number; number: number; size: number }
export const GUARANTEE_FUND_MAX_CENTS = 20000
