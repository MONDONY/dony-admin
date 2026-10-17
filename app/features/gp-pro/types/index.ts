/**
 * Badge GP Pro : file des demandes, revue des titulaires et décisions de l'admin.
 *
 * Contrat : yadony-back #560 (`/admin/gp-pro/**`, permission GP_PRO_REVIEW). Le backend
 * sérialise en NON_NULL : un champ nul est ABSENT du JSON, d'où les champs optionnels.
 */

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
type Meta = { label: string; tone: Tone }

export type GpProApplicationStatus = 'AWAITING_KYC' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type GpProApplicationSource = 'SIGNUP' | 'PROFILE' | 'ADMIN'
export type GpProTravelFrequency = 'WEEKLY' | 'TWICE_A_MONTH' | 'MONTHLY' | 'LESS_OFTEN'
export type GpProDocumentType = 'BUSINESS_REGISTRATION' | 'TRAVEL_PROOF' | 'SOCIAL_PROFILE' | 'OTHER'
export type GpProReviewReason = 'LOW_RATING' | 'OPEN_DISPUTE' | 'OPEN_REPORT' | 'INACTIVE' | 'KYC_NOT_VERIFIED'

/** Une ligne de la file des demandes. */
export interface AdminGpProApplicationRow {
  applicationId: string
  userId: string
  displayName?: string | null
  source?: GpProApplicationSource | string | null
  travelFrequency?: GpProTravelFrequency | string | null
  documentCount?: number
  createdAt?: string | null
}

export interface AdminGpProDocument {
  id: string
  type: GpProDocumentType | string
  /** URL présignée de 15 minutes, jamais publique. */
  url: string
}

/** Fiche d'une demande : la demande, le profil du demandeur et ses justificatifs. */
export interface AdminGpProApplicationDetail {
  applicationId: string
  userId: string
  displayName?: string | null
  status: GpProApplicationStatus | string
  source?: GpProApplicationSource | string | null
  travelFrequency?: GpProTravelFrequency | string | null
  commercialName?: string | null
  createdAt?: string | null
  kycStatus?: string | null
  publishedTrips?: number
  tripsLast56Days?: number
  completedDeliveries?: number
  averageRating?: number | null
  lastFiveRatings?: number[]
  openDisputes?: number
  openReports?: number
  memberSince?: string | null
  documents?: AdminGpProDocument[]
}

export interface AdminGpProReviewFlag {
  flagId: string
  reason: GpProReviewReason | string
}

/** Une personne à réexaminer ; chaque motif s'écarte à part (`flags`). */
export interface AdminGpProReviewRow {
  userId: string
  displayName?: string | null
  reasons?: (GpProReviewReason | string)[]
  detectedAt?: string | null
  flags?: AdminGpProReviewFlag[]
}

export interface SpringPage<T> {
  content?: T[]; totalElements?: number; totalPages?: number; number?: number; size?: number
}

/** Bornes de `GpProDecisionRequest` (refus et retrait) : le motif est lu par l'utilisateur. */
export const GP_PRO_REASON_MIN = 10
export const GP_PRO_REASON_MAX = 1000
/** Borne de `GpProGrantRequest.note` (attribution directe), facultative et interne. */
export const GP_PRO_NOTE_MAX = 1000

export const GP_PRO_UNAVAILABLE = 'GP Pro indisponible tant que le serveur n’est pas mis à jour.'

/** Valide la longueur d'un motif après trim. */
export function reasonValid(reason: string): boolean {
  const n = reason.trim().length
  return n >= GP_PRO_REASON_MIN && n <= GP_PRO_REASON_MAX
}

const FREQUENCY_LABELS: Record<GpProTravelFrequency, string> = {
  WEEKLY: 'Chaque semaine',
  TWICE_A_MONTH: 'Deux fois par mois',
  MONTHLY: 'Une fois par mois',
  LESS_OFTEN: 'Moins souvent',
}
export function frequencyLabel(f: string | null | undefined): string {
  if (!f) return 'Non renseignée'
  return FREQUENCY_LABELS[f as GpProTravelFrequency] ?? f
}

const SOURCE_LABELS: Record<GpProApplicationSource, string> = {
  SIGNUP: 'Inscription',
  PROFILE: 'Profil',
  ADMIN: 'Attribution directe',
}
export function sourceLabel(s: string | null | undefined): string {
  if (!s) return 'Inconnue'
  return SOURCE_LABELS[s as GpProApplicationSource] ?? s
}

const DOC_LABELS: Record<GpProDocumentType, string> = {
  BUSINESS_REGISTRATION: 'Registre d’entreprise',
  TRAVEL_PROOF: 'Billet ou carte d’embarquement',
  SOCIAL_PROFILE: 'Profil de réseau social',
  OTHER: 'Autre document',
}
export function documentTypeLabel(t: string | null | undefined): string {
  if (!t) return 'Document'
  return DOC_LABELS[t as GpProDocumentType] ?? t
}

const REVIEW_LABELS: Record<GpProReviewReason, string> = {
  LOW_RATING: 'Notes récentes sous 4/5',
  OPEN_DISPUTE: 'Litige ouvert',
  OPEN_REPORT: 'Signalement ouvert',
  INACTIVE: 'Aucun trajet depuis 8 semaines',
  KYC_NOT_VERIFIED: 'Identité plus vérifiée',
}
export function reviewReasonLabel(r: string | null | undefined): string {
  if (!r) return 'Motif inconnu'
  return REVIEW_LABELS[r as GpProReviewReason] ?? r
}

const STATUS_META: Record<GpProApplicationStatus, Meta> = {
  AWAITING_KYC: { label: 'Attend la vérification d’identité', tone: 'neutral' },
  PENDING: { label: 'À examiner', tone: 'warning' },
  APPROVED: { label: 'Acceptée', tone: 'success' },
  REJECTED: { label: 'Refusée', tone: 'danger' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
}
export function applicationStatusMeta(s: string | null | undefined): Meta {
  if (!s) return { label: 'Inconnu', tone: 'neutral' }
  return STATUS_META[s as GpProApplicationStatus] ?? { label: s, tone: 'neutral' }
}

/** Repli français quand le ProblemDetail n'a pas de `detail`. */
export const GP_PRO_CODE_MESSAGES: Record<string, string> = {
  'gp-pro-application-not-found': 'Demande introuvable.',
  'gp-pro-application-not-pending': 'Cette demande a déjà été décidée : la file a été relue.',
  'gp-pro-kyc-required': 'L’identité de cette personne doit être vérifiée avant d’accorder GP Pro.',
  'gp-pro-user-not-eligible': 'Le compte est suspendu, banni ou en cours de suppression.',
  'gp-pro-reason-required': 'Un motif est obligatoire.',
  'gp-pro-already-active': 'Le badge GP Pro est déjà actif : la fiche a été relue.',
  'gp-pro-not-active': 'Le badge GP Pro n’est plus actif : la fiche a été relue.',
  'gp-pro-flag-not-found': 'Alerte introuvable : la liste a été relue.',
  'gp-pro-flag-resolved': 'Cette alerte est déjà close : la liste a été relue.',
  'user-not-found': 'Utilisateur introuvable.',
}

/** Conflits qui signifient « l'écran est en retard sur la base » : l'appelant relit. */
export const GP_PRO_STALE_CODES = new Set([
  'gp-pro-application-not-pending', 'gp-pro-already-active', 'gp-pro-not-active',
  'gp-pro-flag-not-found', 'gp-pro-flag-resolved',
])

export function fmtDate(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
