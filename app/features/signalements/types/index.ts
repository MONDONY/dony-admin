// ----- Signalements (reports) -----
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'
export type ReportStatusFilter = 'ALL' | ReportStatus
export type ReportTargetType = 'USER' | 'ANNOUNCEMENT' | 'BID' | 'MESSAGE' | 'RATING' | 'APP'
export type ReportAction = 'DISMISS' | 'WARN' | 'SUSPEND_TARGET' | 'REMOVE_CONTENT'

export interface AdminReport {
  id: string
  targetType: ReportTargetType
  targetId: string
  targetLabel: string | null
  reason: string
  description: string | null
  reporterName: string | null
  status: ReportStatus
  actionTaken: ReportAction | null
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
  photoUrls: string[]
  /** Route de l’écran d’origine pour un rapport du scarabée (SCREEN_BUG), sinon absent. */
  screenRoute?: string | null
}

export interface AdminReportPage {
  content: AdminReport[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface ReportsFilterState {
  status: ReportStatusFilter
  targetType: ReportTargetType | null
  /** Recherche libre (description, route d’écran, signalant, motif) ; vide = pas de filtre. */
  q?: string
}

// ----- Avis (ratings) -----
export interface AdminRating {
  id: string
  bidId: string | null
  raterName: string | null
  ratedName: string | null
  score: number
  comment: string | null
  flagged: boolean
  excluded: boolean
  excludedReason: string | null
  createdAt: string
}

export interface AdminRatingPage {
  content: AdminRating[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface RatingsFilterState {
  flaggedOnly: boolean
}
