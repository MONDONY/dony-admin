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

/**
 * Avis signalé (cible RATING retrouvée), pour le lire avant de l'exclure ou de le supprimer.
 * L'auteur de l'avis est `targetAuthor` ; le compte noté peut avoir été supprimé (champs nuls).
 */
export interface ReportRatingPreview {
  stars: number
  comment: string | null
  createdAt: string
  excludedFromAverage: boolean
  ratedUserId: string | null
  ratedUserName: string | null
}

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
  /** Aperçu de l'avis signalé (cible RATING). Absent sur un ancien back ou une autre cible. */
  ratingPreview?: ReportRatingPreview | null
}

// ----- Contexte d'un signalement (GET /admin/reports/{id}/context) -----
// Le back n'écrit pas les champs nuls (NON_NULL) : tout ce qui peut manquer est facultatif.

/** Le signalant : `resolvedReports` = traités (toute action sauf rejet), `dismissedReports` = rejetés. */
export interface ReportContextReporter {
  userId: string
  displayName?: string | null
  memberSince?: string | null
  totalReports: number
  resolvedReports: number
  dismissedReports: number
}

/** La personne visée : le compte signalé, ou l'auteur du contenu signalé. */
export interface ReportContextSubject {
  userId: string
  displayName?: string | null
  memberSince?: string | null
  /** ACTIVE, SUSPENDED, BANNED ou PENDING_DELETION. */
  accountStatus?: string | null
  identityVerified: boolean
  reportsReceived: number
  openReportsReceived: number
  cancellationCount: number
}

export interface ReportContextMessage {
  id: string
  senderName?: string | null
  body: string
  sentAt?: string | null
  /** Le message signalé. */
  flagged: boolean
  deleted: boolean
  /** Écrit par la personne visée : sa bulle est à droite. */
  fromSubject: boolean
}

export interface ReportHistoryEntry {
  /** Code d'audit : REPORT_RESOLVED, REPORT_DELETED, REPORT_RESTORED. */
  action: string
  /** Action de modération prise, pour une résolution. */
  detail?: string | null
  at?: string | null
  actorEmail?: string | null
  note?: string | null
}

export interface RelatedReport {
  id: string
  reason?: string | null
  status?: string | null
  createdAt?: string | null
  reporterName?: string | null
}

export interface ReportContext {
  reporter?: ReportContextReporter | null
  subject?: ReportContextSubject | null
  /** Absent hors cible MESSAGE, ou quand Firestore n'a rien rendu. */
  messages?: ReportContextMessage[] | null
  /** Cible MESSAGE sans MODERATION_VIEW : seul le message signalé est lisible. */
  messagesRestricted?: boolean
  history?: ReportHistoryEntry[] | null
  relatedReports?: RelatedReport[] | null
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
