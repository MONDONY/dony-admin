import type { AdminSupportTicket } from '@/features/support/types/index'

// ----- Signalements (reports) -----
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'
export type ReportStatusFilter = 'ALL' | ReportStatus
/** Type de retour d'un rapport du scarabée : Bug, Avis ou Suggestion. */
export type ReportKind = 'BUG' | 'AVIS' | 'SUGGESTION'
export type ReportTargetType = 'USER' | 'ANNOUNCEMENT' | 'BID' | 'MESSAGE' | 'RATING' | 'APP' | 'PACKAGE_REQUEST'
/**
 * Miroir de `com.yadony.api.signalements.ReportAction`. RESOLVE (« Marquer comme traité »)
 * s'applique à tout type de cible ; les actions *_AUTHOR visent l'auteur d'un message, d'un
 * avis ou d'une candidature (`targetAuthor`).
 */
export type ReportAction =
  | 'RESOLVE'
  | 'DISMISS'
  | 'WARN'
  | 'SUSPEND_TARGET'
  | 'REMOVE_CONTENT'
  | 'DELETE_MESSAGE'
  | 'EXCLUDE_RATING'
  | 'DELETE_RATING'
  | 'WARN_AUTHOR'
  | 'SUSPEND_AUTHOR'

/** Auteur de la cible (message, avis, candidature) quand le back sait le résoudre. */
export interface ReportTargetAuthor {
  userId: string
  name: string | null
}

export interface AdminReport {
  id: string
  targetType: ReportTargetType
  targetId: string
  targetLabel: string | null
  reason: string
  description: string | null
  reporterName: string | null
  status: ReportStatus
  /** Action prise ; une chaîne inconnue (back plus récent) s'affiche telle quelle. */
  actionTaken: ReportAction | string | null
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
  photoUrls: string[]
  /** Route de l’écran d’origine pour un rapport du scarabée (SCREEN_BUG), sinon absent. */
  screenRoute?: string | null
  /** Signalement supprimé (liste `deleted=true` du nouveau back) : absents sinon (NON_NULL). */
  deletedAt?: string | null
  deletedByAdminEmail?: string | null
  /**
   * Actions que CET admin peut appliquer (type de cible × cible résolvable × permissions),
   * calculées par le back ; vide si le signalement est déjà traité. Absent sur un ancien
   * back : le front retombe alors sur ses propres règles.
   */
  availableActions?: string[] | null
  targetAuthor?: ReportTargetAuthor | null
  /**
   * Conversation support ouverte avec le signalant depuis ce rapport de bug (réponse de
   * l'admin), sinon null. Absent sur un ancien back : aucun badge.
   */
  supportTicketId?: string | null
  /**
   * Le back autorise CET admin à répondre au signalant (rapport de bug APP, signalant
   * joignable, SUPPORT_TICKET_MANAGE). Absent sur un ancien back : règle locale.
   */
  canReply?: boolean | null
}

/** Corps de POST /admin/reports/{id}/reply : message obligatoire (1 à 4000 caractères). */
export interface ReportReplyPayload {
  message: string
  attachmentKeys?: string[]
}

/** Réponse de POST /admin/reports/{id}/reply : `created` = nouvelle conversation. */
export interface ReportReplyResponse {
  ticketId: string
  created: boolean
  ticket: AdminSupportTicket
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
  /** Type de retour du scarabée ; sert de recherche `[TYPE]`, donc ignoré quand `q` est rempli. */
  kind?: ReportKind | null
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
