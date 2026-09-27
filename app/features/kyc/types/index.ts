/**
 * File des vérifications d'identité et décisions manuelles KYC.
 *
 * Contrat : yadony-back `feature/admin-kyc-file-decisions`. Le backend sérialise en NON_NULL :
 * un champ nul est ABSENT du JSON, d'où les champs optionnels partout.
 */

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'
type Meta = { label: string; tone: Tone }

/** Statuts filtrables de la file (paramètre `status` de GET /admin/kyc/verifications). */
export const KYC_QUEUE_STATUSES = ['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'VERIFIED', 'NOT_STARTED'] as const
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
  /** État métier de la ligne dans la file (IN_REVIEW, IN_PROGRESS…), à afficher en priorité. */
  queueStatus?: KycQueueStatus | string | null
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
  { value: 'IN_PROGRESS', label: 'Parcours en cours' },
  { value: 'REJECTED', label: 'Refusées' },
  { value: 'VERIFIED', label: 'Validées' },
  { value: 'NOT_STARTED', label: 'Non commencées' },
]

export function isKycQueueStatus(v: unknown): v is KycQueueStatus {
  return typeof v === 'string' && (KYC_QUEUE_STATUSES as readonly string[]).includes(v)
}

const STATUS: Record<string, Meta> = {
  IN_REVIEW: { label: 'En attente de décision', tone: 'warning' },
  IN_PROGRESS: { label: 'Parcours en cours', tone: 'info' },
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

/** Actions de `history[]` servies par le back (#335). Une action inconnue reste lisible. */
const HISTORY_ACTIONS: Record<string, string> = {
  // USER
  KYC_SESSION_CREATED: 'Parcours de vérification commencé',
  KYC_SESSION_ABANDONED: 'Parcours abandonné par l’utilisateur',
  // PROVIDER
  KYC_VERIFIED: 'Identité validée par le fournisseur',
  KYC_REJECTED: 'Identité refusée par le fournisseur',
  KYC_IN_REVIEW: 'Mise en revue manuelle par le fournisseur',
  KYC_ABANDONED: 'Vérification abandonnée chez le fournisseur',
  KYC_EXPIRED: 'Session expirée chez le fournisseur',
  KYC_CANCELED: 'Session annulée chez le fournisseur',
  // ADMIN
  KYC_RESET_BY_ADMIN: 'Vérification réinitialisée par un admin',
  KYC_VERIFIED_BY_ADMIN: 'Identité validée par un admin',
  KYC_REJECTED_BY_ADMIN: 'Identité refusée par un admin',
  KYC_REVOKED_BY_ADMIN: 'Identité révoquée par un admin',
}
export function kycHistoryActionLabel(action: string): string {
  const known = HISTORY_ACTIONS[action]
  if (known) return known
  const words = action.toLowerCase().replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Catalogue LOCAL des codes de refus et de révocation : repli quand GET
 * /admin/kyc/rejection-codes est absent (ancien back). Miroir exact de `KycRejectionCodes.ALL`
 * côté back, soit les codes que l'app mobile traduit (`kyc_rejection_messages.dart`) plus
 * `suspected_fraud` et `other`. `userMessage` est le texte que l'app montre pour ce code ; les
 * deux derniers lui sont inconnus et tombent sur son message générique.
 */
const GENERIC_USER_MESSAGE = 'Nous n\'avons pas pu vérifier votre identité. Assurez-vous que votre document est lisible et réessayez.'
const ID_NUMBER_MESSAGE = 'Les informations de votre document n\'ont pas pu être confirmées. Vérifiez qu\'elles sont bien lisibles et réessayez.'
const SELFIE_MESSAGE = 'Votre selfie n\'a pas pu être vérifié. Réessayez dans un endroit bien éclairé, sans lunettes ni couvre-chef.'

export interface KycDecisionCode { value: string; label: string; userMessage: string }
export const KYC_DECISION_CODES: readonly KycDecisionCode[] = [
  { value: 'document_expired', label: 'Document expiré', userMessage: 'Votre pièce d\'identité est expirée. Utilisez un document valide et réessayez.' },
  { value: 'document_type_not_supported', label: 'Type de document non accepté', userMessage: 'Ce type de document n\'est pas accepté. Utilisez une carte d\'identité, un passeport ou un permis de conduire.' },
  { value: 'document_unverified_other', label: 'Document illisible ou invérifiable', userMessage: 'Le document fourni n\'a pas pu être lu ou vérifié. Assurez-vous qu\'il est net, complet et bien éclairé, puis réessayez.' },
  { value: 'country_not_supported', label: 'Pays du document non pris en charge', userMessage: 'Le pays de votre document n\'est pas pris en charge pour la vérification.' },
  { value: 'id_number_insufficient_document_data', label: 'Données du document insuffisantes', userMessage: ID_NUMBER_MESSAGE },
  { value: 'id_number_mismatch', label: 'Informations du document non concordantes', userMessage: ID_NUMBER_MESSAGE },
  { value: 'id_number_unverified_other', label: 'Numéro de document invérifiable', userMessage: ID_NUMBER_MESSAGE },
  { value: 'selfie_document_missing_photo', label: 'Document sans photo exploitable', userMessage: 'La photo sur votre document n\'a pas pu être comparée à votre selfie. Réessayez avec une pièce d\'identité comportant une photo nette.' },
  { value: 'selfie_face_mismatch', label: 'Selfie différent de la photo du document', userMessage: 'Votre selfie ne correspond pas à la photo du document. Reprenez la vérification dans de bonnes conditions de lumière.' },
  { value: 'selfie_manipulated', label: 'Selfie manipulé', userMessage: SELFIE_MESSAGE },
  { value: 'selfie_unverified_other', label: 'Selfie invérifiable', userMessage: SELFIE_MESSAGE },
  { value: 'under_supported_age', label: 'Utilisateur mineur', userMessage: 'La vérification d\'identité est réservée aux personnes majeures.' },
  { value: 'consent_declined', label: 'Consentement refusé', userMessage: 'Vous avez refusé de donner votre consentement, indispensable pour vérifier votre identité.' },
  { value: 'session_canceled', label: 'Vérification abandonnée', userMessage: 'La vérification a été fermée avant d\'être terminée.' },
  { value: 'suspected_fraud', label: 'Suspicion de fraude', userMessage: GENERIC_USER_MESSAGE },
  { value: 'other', label: 'Autre motif', userMessage: GENERIC_USER_MESSAGE },
]

export function kycDecisionCodeLabel(code: string | null | undefined): string {
  if (!code) return 'Aucun'
  return KYC_DECISION_CODES.find((c) => c.value === code)?.label ?? code
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

/** Code servi par le back : libellé et message français connus, sinon le code brut. */
export function kycDecisionCode(value: string): KycDecisionCode {
  return KYC_DECISION_CODES.find((c) => c.value === value) ?? { value, label: value, userMessage: GENERIC_USER_MESSAGE }
}

export const KYC_QUEUE_UNAVAILABLE = 'File des vérifications indisponible pour le moment'
export const KYC_DECISIONS_UNAVAILABLE = 'Les décisions manuelles ne sont pas encore disponibles sur ce serveur.'
