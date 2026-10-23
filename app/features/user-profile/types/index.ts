/** Formes de réponse de GET /admin/users/{id}/overview et des sections (records Java userview/dto). */

/** `amountCents` = montant x 100 pour toutes les devises, XOF compris : toujours `formatAmount(cents, currency)`. */
export interface MoneyAmount { currency: string; amountCents: number }

/** Un champ `null` = permission absente ou valeur pas encore calculée (jamais zéro). */
export interface UserOverviewKpis {
  parcelsInProgress: number | null
  activeTrips: number | null
  /** Montant brut retenu (commission comprise), une ligne par devise. */
  heldByCurrency: MoneyAmount[] | null
  openDisputes: number | null
  totalDisputes: number | null
  reportsReceived: number | null
  reportsSent: number | null
  reportsPending: number | null
  averageRating: number | null
  ratingCount: number | null
}

export interface InProgressItem {
  kind: 'PARCEL' | 'TRIP'
  id: string
  reference: string
  corridor: string
  role: string
  status: string
  updatedAt: string
  amount: MoneyAmount | null
}

export interface TimelineEntry {
  kind: 'PARCEL' | 'PAYMENT' | 'DISPUTE' | 'REPORT'
  title: string
  detail: string
  at: string
  refType: string | null
  refId: string | null
}

export interface UserOverview {
  kpis: UserOverviewKpis
  inProgress: InProgressItem[] | null
  timeline: TimelineEntry[] | null
}

export type UserSection =
  'parcels' | 'trips' | 'requests' | 'payments' | 'disputes' | 'cancellations' | 'reports' | 'ratings' | 'audit'

export interface SectionPage<T> {
  content: T[]
  totalPages: number
  number: number
  totalElements: number
}

export interface UserParcelRow {
  id: string
  trackingNumber: string | null
  corridor: string
  /** SENDER | TRAVELER */
  role: string
  status: string
  createdAt: string
  deliveredAt: string | null
  amount: MoneyAmount | null
  announcementId: string | null
}

/** Ligne de /trips : AdminAnnouncementListItemResponse existant. `departureDate` est un jour (yyyy-MM-dd). */
export interface UserTripRow {
  id: string
  status: string
  travelerName: string | null
  corridor: string
  departureDate: string
  availableKg: number
  pricePerKg: number
  currency: string | null
  tripGroupId: string | null
  tripLegIndex: number | null
  tripLegCount: number | null
}

export interface UserRequestRow {
  id: string
  corridor: string
  status: string
  weightKg: number | null
  /** Jour calendaire envoyé comme minuit UTC : formater avec `formatDayUtc`. */
  desiredDate: string | null
  createdAt: string
  openNegotiationCount: number
}

export interface UserPaymentRow {
  id: string
  bidId: string
  status: string
  method: string | null
  amountCents: number
  commissionCents: number
  currency: string
  createdAt: string
  payoutHeldAt: string | null
  beneficiaryHeld: boolean
  /** PAYER | BENEFICIARY */
  role: string
}

export interface UserDisputeRow {
  id: string
  bidId: string
  type: string
  status: string
  /** SENDER | TRAVELER | REPORTER */
  role: string
  createdAt: string
  resolvedAt: string | null
}

export interface UserCancellationRow {
  id: string
  bidId: string
  reason: string | null
  scope: string | null
  status: string
  /** Faux quand l'utilisateur a subi l'annulation. */
  declaredByUser: boolean
  createdAt: string
}

export interface UserReportRow {
  id: string
  /** RECEIVED | SENT */
  direction: string
  targetType: string
  reason: string
  status: string
  createdAt: string
}

export interface UserRatingRow {
  id: string
  bidId: string
  stars: number
  comment: string | null
  flagged: boolean
  createdAt: string
}

export interface UserAuditRow {
  id: number
  action: string
  /** E-mail pour un administrateur ; null si l'acteur est inconnu. */
  actorName: string | null
  actorId: string | null
  reason: string | null
  createdAt: string
}
