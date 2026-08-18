export type BidStatus = 'AWAITING_PAYMENT' | 'PENDING' | 'PAYMENT_ESCROWED' | 'ACCEPTED' | 'HANDED_OVER' | 'IN_TRANSIT' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'PARCEL_REFUSED' | 'EXPIRED'
export type BidStatusFilter = 'TOUS' | BidStatus
export type AnnouncementStatus = 'ACTIVE' | 'FULL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REMOVED_BY_ADMIN'
export type TimelineKind = 'SCAN' | 'PHOTO' | 'PAYMENT' | 'EVENT'

export interface AdminBidListItem {
  id: string; status: BidStatus; announcementId: string
  senderName: string | null; travelerName: string | null; corridor: string
  weightKg: number; netEur: number; paymentMethod: string; createdAt: string
}
export interface AdminBidDetail extends AdminBidListItem {
  declaredValueEur: number; contentCategory: string | null; recipientName: string | null
  trackingNumber: string | null; commissionRate: number | null; refusalReason: string | null
}
export interface BidTimelineEntry {
  at: string; kind: TimelineKind; label: string
  detail?: string | null; photoUrl?: string | null; gpsLat?: number | null; gpsLon?: number | null
}
export interface AdminBidTimeline { bidId: string; entries: BidTimelineEntry[] }
export interface AdminAnnouncementListItem {
  id: string; status: AnnouncementStatus; travelerName: string | null
  corridor: string; departureDate: string; availableKg: number; pricePerKg: number
}
export interface AdminBidPage { content: AdminBidListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminAnnouncementPage { content: AdminAnnouncementListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface BidsFilterState { status: BidStatusFilter; announcementId: string | null; query: string; dateFrom: string | null; dateTo: string | null }
