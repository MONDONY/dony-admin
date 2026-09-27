/**
 * Demandes d'envoi (package requests) vues par la modération. Contrat de
 * `GET /admin/package-requests` et `GET /admin/package-requests/{id}` (yadony-back
 * `feature/admin-moderation-demandes`). Les statuts et codes restent des `string` côté
 * données : un statut ajouté côté back avant le front s'affiche tel quel au lieu de casser.
 */
export const PACKAGE_REQUEST_STATUSES = [
  'DRAFT', 'OPEN', 'NEGOTIATING', 'ACCEPTED', 'EXPIRED', 'CANCELLED', 'COMPLETED', 'REMOVED_BY_ADMIN',
] as const
export type PackageRequestStatus = typeof PACKAGE_REQUEST_STATUSES[number]
export type PackageRequestStatusFilter = 'ALL' | PackageRequestStatus

export interface AdminPackageRequestListItem {
  id: string
  senderId: string
  senderName: string | null
  departureCity: string
  arrivalCity: string
  desiredDate: string | null
  weightKg: number | null
  parcelSize: string | null
  transportMode: string | null
  status: string
  currency: string | null
  /** Budget net de l'expéditeur, en unités principales de `currency` ; null = à négocier. */
  targetPrice: number | null
  createdAt: string
  reportCount: number
  openNegotiationCount: number
}

export interface AdminPackageRequestPhoto { url: string }

export interface AdminPackageRequestNegotiation {
  id: string
  travelerId: string
  travelerName: string | null
  status: string
  lastPrice: number | null
  currency: string | null
  updatedAt: string
}

export interface AdminPackageRequestReport {
  id: string
  reporterId: string
  reporterName: string | null
  reason: string
  details: string | null
  /** Statut du signalement dans /admin/reports (OPEN, RESOLVED, DISMISSED). */
  status: string
  createdAt: string
}

export interface AdminPackageRequestDetail extends AdminPackageRequestListItem {
  /** Souplesse autour de `desiredDate`, en jours (0 = date exacte). */
  dateToleranceDays: number
  recipientCity: string | null
  description: string | null
  contentCategory: string | null
  pickupNeighborhood: string | null
  deliveryNeighborhood: string | null
  pickupAddressLabel: string | null
  deliveryAddressLabel: string | null
  acceptedPaymentMethods: string[]
  negotiable: boolean
  statusBeforeRemoval: string | null
  /** URLs présignées, à durée de vie courte : jamais mises en cache ni recopiées. */
  photos: AdminPackageRequestPhoto[]
  negotiations: AdminPackageRequestNegotiation[]
  reports: AdminPackageRequestReport[]
  canRemove: boolean
  /**
   * Code expliquant pourquoi `canRemove` est faux (`package-request-already-removed`, `-draft`,
   * `-completed`, `-has-active-shipment`) ; null quand le retrait est possible.
   */
  removeBlockedReason: string | null
  canRestore: boolean
}

export interface AdminPackageRequestPage {
  content: AdminPackageRequestListItem[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface PackageRequestFilters {
  status: PackageRequestStatusFilter
  query: string
  reportedOnly: boolean
  /** Bornes de la période de création, `YYYY-MM-DD` ; null = pas de borne. */
  from: string | null
  to: string | null
}
