export type BidStatus = 'AWAITING_PAYMENT' | 'PENDING' | 'PAYMENT_ESCROWED' | 'ACCEPTED' | 'HANDED_OVER' | 'IN_TRANSIT' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'PARCEL_REFUSED' | 'EXPIRED'
export type BidStatusFilter = 'TOUS' | BidStatus
export type AnnouncementStatus = 'ACTIVE' | 'FULL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REMOVED_BY_ADMIN'
export type TimelineKind = 'SCAN' | 'PHOTO' | 'PAYMENT' | 'EVENT'

export interface AdminBidListItem {
  id: string; status: BidStatus; announcementId: string
  senderName: string | null; travelerName: string | null; corridor: string
  /** netEur est dans `currency` (devise de l'annonce), null pour une demande sans prix négocié. */
  weightKg: number; netEur: number | null; currency: string | null; paymentMethod: string; createdAt: string
}
/** Trajet du colis : l'annonce du voyageur (back yadony-back « fiche colis »). */
export interface AdminBidTrip {
  announcementId: string; status: string | null
  departureCity: string | null; arrivalCity: string | null
  departureCountryCode: string | null; arrivalCountryCode: string | null
  departureDate: string | null; departureTime: string | null; departureAt: string | null
  arrivalDate: string | null; arrivalTime: string | null; timezone: string | null
  pickupAddressLabel: string | null; deliveryAddressLabel: string | null
  transportMode: string | null
  totalKg: number | null; availableKg: number | null; reservedKg: number | null; capacityUnit: string | null
  pricePerKg: number | null
  tripGroupId: string | null; tripLegIndex: number | null
  handoverDeadline: string | null
  otherBidsCount: number
}
/**
 * Expéditeur ou voyageur. Sans USER_VIEW, le back ne renvoie que l'identité (statuts et
 * téléphone à null). Les champs de versement ne concernent que le voyageur.
 */
export interface AdminBidParty {
  id: string; name: string | null; username: string | null; phoneMasked: string | null
  status: string | null; kycStatus: string | null
  stripeAccountStatus: string | null; stripeConnectUsable: boolean | null
  mobileMoneyStatus: string | null; mobileMoneyUsable: boolean | null
}
export interface AdminBidMoney {
  paymentId: string; status: string | null; rail: string | null
  amountCents: number; commissionCents: number; refundedCents: number; currency: string | null
  capturedAt: string | null; escrowReleasedAt: string | null; payoutHeldAt: string | null; disputed: boolean
}
export interface AdminBidLinks {
  negotiationThreadId: string | null; disputeId: string | null; disputeStatus: string | null
  /** Identifiant Firestore : celui de la page Modération. */
  conversationId: string | null; cancellationId: string | null
}
export interface AdminBidMilestones {
  handoverLocation: string | null; handoverDeadline: string | null
  arrivedAt: string | null; deliveredAt: string | null; noShowAt: string | null; returnedAt: string | null
}
/**
 * Fiche colis. Les champs après `refusalReason` viennent du back « fiche colis » : absents
 * (`undefined`) face à un ancien back, la section concernée affiche « non disponible ».
 */
export interface AdminBidDetail extends AdminBidListItem {
  contentCategory: string | null; recipientName: string | null
  trackingNumber: string | null; commissionRate: number | null; refusalReason: string | null
  description?: string | null
  trip?: AdminBidTrip | null
  sender?: AdminBidParty | null
  traveler?: AdminBidParty | null
  recipient?: { name: string | null; phoneMasked: string | null } | null
  /** null : aucun paiement en ligne, ou pas le droit PAYMENT_VIEW. */
  money?: AdminBidMoney | null
  links?: AdminBidLinks | null
  confirmationCodePresent?: boolean | null
  photoUrls?: string[] | null
  milestones?: AdminBidMilestones | null
}
export interface BidTimelineEntry {
  at: string; kind: TimelineKind; label: string
  detail?: string | null; photoUrl?: string | null; gpsLat?: number | null; gpsLon?: number | null
  /** Back « fiche colis » : origine de l'entrée et auteur. */
  source?: 'TRACKING' | 'AUDIT' | 'PAYMENT' | 'BID' | null
  actorKind?: 'ADMIN' | 'USER' | null
  actorLabel?: string | null
}
export interface AdminBidTimeline { bidId: string; entries: BidTimelineEntry[] }
export interface AdminAnnouncementListItem {
  id: string; status: AnnouncementStatus; travelerName: string | null
  corridor: string; departureDate: string; availableKg: number; pricePerKg: number
  /** Devise du prix au kilo (code ISO). */
  currency: string | null
  /** Voyage à plusieurs étapes (FLUTTER-4D) : identifiant commun aux étapes. Absent (ancien back) ou null hors voyage. */
  tripGroupId?: string | null
  /** Rang de l'étape dans son voyage, à partir de 1. */
  tripLegIndex?: number | null
  /** Nombre d'étapes encore présentes dans le voyage. */
  tripLegCount?: number | null
}
export interface AdminBidPage { content: AdminBidListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface AdminAnnouncementPage { content: AdminAnnouncementListItem[]; totalElements: number; totalPages: number; number: number; size: number }
export interface BidsFilterState { status: BidStatusFilter; announcementId: string | null; query: string; dateFrom: string | null; dateTo: string | null }
