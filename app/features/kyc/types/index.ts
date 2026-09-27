/**
 * File des vérifications d'identité et décisions manuelles KYC.
 *
 * Contrat : yadony-back `feature/admin-kyc-file-decisions`. Le backend sérialise en NON_NULL :
 * un champ nul est ABSENT du JSON, d'où les champs optionnels partout.
 */

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
type Meta = { label: string; tone: Tone }

/** Statuts filtrables de la file (paramètre `status` de GET /admin/kyc/verifications). */
export const KYC_QUEUE_STATUSES = ['IN_REVIEW', 'REJECTED', 'VERIFIED', 'NOT_STARTED'] as const
export type KycQueueStatus = typeof KYC_QUEUE_STATUSES[number]

export const KYC_PROVIDERS = ['DIDIT', 'STRIPE'] as const
export type KycProvider = typeof KYC_PROVIDERS[number]

export type KycDecisionKind = 'APPROVED' | 'REJECTED' | 'REVOKED'
export type KycActorKind = 'USER' | 'ADMIN' | 'SYSTEM' | 'PROVIDER'

/** Une ligne de la file. `userPhone` arrive déjà masqué par le back. */
export interface AdminKycQueueItem {
  userId: string
  userName?: string | null
  userPhone?: string | null
  provider?: KycProvider | string | null
  kycStatus: string
  recordStatus?: string | null
  rejectionCode?: string | null
  rejectionReason?: string | null
  decisionKind?: KycDecisionKind | string | null
  decidedAt?: string | null
  decidedByAdminEmail?: string | null
  submittedAt?: string | null
  waitingHours?: number | null
}
export interface AdminKycQueuePage {
  content?: AdminKycQueueItem[]; totalElements?: number; totalPages?: number; number?: number; size?: number
}

export interface KycQueueFilters {
  status: KycQueueStatus
  provider: KycProvider | null
  query: string
  /** YYYY-MM-DD */
  from: string | null
  to: string | null
}

/** Un événement de l'historique d'une vérification. */
export interface KycHistoryEntry {
  action: string
  at: string
  actorKind: KycActorKind | string
  actorEmail?: string | null
  detail?: string | null
}

/** Champs ajoutés par le nouveau back à GET /admin/users/{id}/kyc (absents d'un ancien back). */
export interface KycDecisionFields {
  provider?: KycProvider | string | null
  decisionKind?: KycDecisionKind | string | null
  decidedAt?: string | null
  decidedByAdminEmail?: string | null
  decisionReason?: string | null
  providerSessionUrl?: string | null
  history?: KycHistoryEntry[]
}

export const KYC_QUEUE_STATUS_TABS: readonly { value: KycQueueStatus; label: string }[] = [
  { value: 'IN_REVIEW', label: 'En attente de décision' },
  { value: 'REJECTED', label: 'Refusées' },
  { value: 'VERIFIED', label: 'Validées' },
  { value: 'NOT_STARTED', label: 'Non commencées' },
]

export function isKycQueueStatus(v: unknown): v is KycQueueStatus {
  return typeof v === 'string' && (KYC_QUEUE_STATUSES as readonly string[]).includes(v)
}

const STATUS: Record<string, Meta> = {
  IN_REVIEW: { label: 'En attente de décision', tone: 'warning' },
  PENDING: { label: 'En cours chez le fournisseur', tone: 'info' },
  VERIFIED: { label: 'Validée', tone: 'success' },
  REJECTED: { label: 'Refusée', tone: 'danger' },
  NOT_STARTED: { label: 'Non commencée', tone: 'neutral' },
}
/** Statut inconnu (ajouté côté back avant le front) : affiché brut, ton neutre. */
export function kycStatusMeta(status: string): Meta {
  return STATUS[status] ?? { label: status, tone: 'neutral' }
}

const PROVIDERS: Record<string, string> = { DIDIT: 'Didit', STRIPE: 'Stripe Identity' }
export function kycProviderLabel(provider: string | null | undefined): string {
  if (!provider) return 'Aucun'
  return PROVIDERS[provider] ?? provider
}

const DECISIONS: Record<string, Meta> = {
  APPROVED: { label: 'Validée par un admin', tone: 'success' },
  REJECTED: { label: 'Refusée par un admin', tone: 'danger' },
  REVOKED: { label: 'Révoquée par un admin', tone: 'danger' },
}
export function kycDecisionMeta(kind: string): Meta {
  return DECISIONS[kind] ?? { label: kind, tone: 'neutral' }
}

const ACTORS: Record<string, string> = {
  USER: 'Utilisateur', ADMIN: 'Administrateur', SYSTEM: 'Système', PROVIDER: 'Fournisseur',
}
export function kycActorLabel(kind: string): string {
  return ACTORS[kind] ?? kind
}

/** Provisoire : le back figera la liste des actions. Une action inconnue reste lisible. */
const HISTORY_ACTIONS: Record<string, string> = {
  SESSION_CREATED: 'Vérification démarrée',
  SESSION_STARTED: 'Vérification démarrée',
  SUBMITTED: 'Pièces envoyées au fournisseur',
  PROVIDER_IN_REVIEW: 'Mise en revue par le fournisseur',
  PROVIDER_VERIFIED: 'Identité validée par le fournisseur',
  PROVIDER_REJECTED: 'Identité refusée par le fournisseur',
  ADMIN_APPROVED: 'Identité validée par un admin',
  ADMIN_REJECTED: 'Identité refusée par un admin',
  ADMIN_REVOKED: 'Identité révoquée par un admin',
  ADMIN_RESET: 'Vérification réinitialisée par un admin',
  RESET: 'Vérification réinitialisée',
}
export function kycHistoryActionLabel(action: string): string {
  const known = HISTORY_ACTIONS[action]
  if (known) return known
  const words = action.toLowerCase().replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Catalogue PROVISOIRE des codes de refus et de révocation (le back le figera).
 *
 * Les codes sont ceux que l'app mobile sait déjà traduire (`kyc_rejection_messages.dart`,
 * codes Didit / Stripe Identity) : l'utilisateur lit donc exactement `userMessage`. Les deux
 * derniers codes lui sont inconnus et tombent sur son message générique, repris ici.
 */
const GENERIC_USER_MESSAGE = 'Nous n\'avons pas pu vérifier votre identité. Assurez-vous que votre document est lisible et réessayez.'

export interface KycDecisionCode { value: string; label: string; userMessage: string }
export const KYC_DECISION_CODES: readonly KycDecisionCode[] = [
  { value: 'document_unverified_other', label: 'Document illisible ou invérifiable', userMessage: 'Le document fourni n\'a pas pu être lu ou vérifié. Assurez-vous qu\'il est net, complet et bien éclairé, puis réessayez.' },
  { value: 'document_expired', label: 'Document expiré', userMessage: 'Votre pièce d\'identité est expirée. Utilisez un document valide et réessayez.' },
  { value: 'document_type_not_supported', label: 'Type de document non accepté', userMessage: 'Ce type de document n\'est pas accepté. Utilisez une carte d\'identité, un passeport ou un permis de conduire.' },
  { value: 'id_number_mismatch', label: 'Informations du document non concordantes', userMessage: 'Les informations de votre document n\'ont pas pu être confirmées. Vérifiez qu\'elles sont bien lisibles et réessayez.' },
  { value: 'selfie_face_mismatch', label: 'Selfie différent de la photo du document', userMessage: 'Votre selfie ne correspond pas à la photo du document. Reprenez la vérification dans de bonnes conditions de lumière.' },
  { value: 'selfie_manipulated', label: 'Selfie manipulé ou invérifiable', userMessage: 'Votre selfie n\'a pas pu être vérifié. Réessayez dans un endroit bien éclairé, sans lunettes ni couvre-chef.' },
  { value: 'under_supported_age', label: 'Utilisateur mineur', userMessage: 'La vérification d\'identité est réservée aux personnes majeures.' },
  { value: 'suspected_fraud', label: 'Suspicion de fraude', userMessage: GENERIC_USER_MESSAGE },
  { value: 'other', label: 'Autre motif', userMessage: GENERIC_USER_MESSAGE },
]

/** Codes renvoyés par les fournisseurs, hors catalogue de décision (affichage seulement). */
const PROVIDER_CODE_LABELS: Record<string, string> = {
  country_not_supported: 'Pays du document non pris en charge',
  id_number_insufficient_document_data: 'Données du document insuffisantes',
  id_number_unverified_other: 'Numéro de document invérifiable',
  selfie_document_missing_photo: 'Document sans photo exploitable',
  selfie_unverified_other: 'Selfie invérifiable',
  consent_declined: 'Consentement refusé',
  session_canceled: 'Vérification abandonnée',
}

export function kycDecisionCodeLabel(code: string | null | undefined): string {
  if (!code) return 'Aucun'
  return KYC_DECISION_CODES.find((c) => c.value === code)?.label ?? PROVIDER_CODE_LABELS[code] ?? code
}
export function kycDecisionCodeUserMessage(code: string): string {
  return KYC_DECISION_CODES.find((c) => c.value === code)?.userMessage ?? GENERIC_USER_MESSAGE
}

/** Bornes des motifs, miroir provisoire de la validation back (10 à 1000, 20 pour révoquer). */
export const KYC_APPROVE_REASON_MIN = 10
export const KYC_REJECT_REASON_MIN = 10
export const KYC_REVOKE_REASON_MIN = 20
export const KYC_REASON_MAX = 1000
export function reasonLengthValid(reason: string, min: number, max = KYC_REASON_MAX): boolean {
  const n = reason.trim().length
  return n >= min && n <= max
}

/** Au-delà de ce délai, une vérification en attente est en retard (colonne en rouge). */
export const KYC_OVERDUE_HOURS = 48
export function isOverdue(hours: number | null | undefined): boolean {
  return typeof hours === 'number' && hours > KYC_OVERDUE_HOURS
}
export function formatWaiting(hours: number | null | undefined): string {
  if (typeof hours !== 'number' || Number.isNaN(hours)) return 'Inconnue'
  if (hours < 1) return 'Moins d’1 h'
  const whole = Math.floor(hours)
  if (whole < KYC_OVERDUE_HOURS) return `${whole} h`
  const days = Math.floor(whole / 24)
  const rest = whole % 24
  return rest ? `${days} j ${rest} h` : `${days} j`
}

export const KYC_QUEUE_UNAVAILABLE = 'File des vérifications indisponible pour le moment'
export const KYC_DECISIONS_UNAVAILABLE = 'Les décisions manuelles ne sont pas encore disponibles sur ce serveur.'
