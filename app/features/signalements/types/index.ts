// ----- Signalements (reports) -----
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'
export type ReportStatusFilter = 'ALL' | ReportStatus
export type ReportTargetType = 'USER' | 'ANNOUNCEMENT' | 'BID' | 'MESSAGE' | 'RATING' | 'APP' | 'PACKAGE_REQUEST'
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
  /** Signalement supprimé (liste `deleted=true` du nouveau back) : absents sinon (NON_NULL). */
  deletedAt?: string | null
  deletedByAdminEmail?: string | null
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
  /** « Supprimés » : envoyé en `deleted=true`, jamais quand il est faux ; le statut est alors ignoré. */
  deleted?: boolean
}

/** Réponse de POST /admin/reports/bulk-restore : `skipped` compte les signalements déjà actifs. */
export interface BulkRestoreResult {
  restored: number
  skipped: number
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
  /** Avis supprimé (liste `deleted=true` du nouveau back) : absents sinon (NON_NULL). */
  deletedAt?: string | null
  deletedByAdminEmail?: string | null
  deleteReason?: string | null
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
  /** « Supprimés » : envoyé en `deleted=true`, jamais quand il est faux. */
  deleted?: boolean
}
