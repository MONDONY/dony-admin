/**
 * ⚠️ Le ciblage est comportemental côté back : `SENDERS` = a créé au moins un bid,
 * `TRAVELERS` = a publié au moins une annonce. Ce n'est PAS un filtre par rôle — tout
 * compte porte SENDER et TRAVELER depuis la migration V193, un filtre par rôle enverrait
 * donc à tout le monde dans les deux cas.
 */
export type BroadcastTargetType = 'ALL' | 'SENDERS' | 'TRAVELERS' | 'CORRIDOR' | 'USER' | 'RULE'

export interface BroadcastTarget {
  type: BroadcastTargetType
  /** Ville de départ — obligatoire, et seulement, pour `CORRIDOR`. */
  origin?: string
  /** Ville d'arrivée — obligatoire, et seulement, pour `CORRIDOR`. */
  destination?: string
  /** Obligatoire, et seulement, pour `USER`. */
  userId?: string
  /** `RULE` : règle à la volée. Exclusif avec `segmentId` (la règle prime côté client). */
  rule?: RuleGroup
  /** `RULE` : segment enregistré, résolu par le back. */
  segmentId?: string
}

export const RULE_MAX_DEPTH = 3
export const RULE_MAX_CONDITIONS = 30

export type RuleOp = 'AND' | 'OR'
export type AudienceValueType = 'NONE' | 'BOOLEAN' | 'ENUM' | 'ENUM_MULTI' | 'INT' | 'CORRIDOR' | 'TEXT'

export interface RuleCondition {
  kind: 'condition'
  /** Identifiant local (clé Vue), jamais envoyé au back. */
  id: string
  field: string
  operator: string
  value: unknown
}

export interface RuleGroup {
  kind: 'group'
  id: string
  op: RuleOp
  children: Array<RuleGroup | RuleCondition>
}

export interface AudienceField {
  key: string
  family: 'STATUS' | 'ACTIVITY' | 'GEO' | 'MONEY'
  label: string
  operators: { key: string; label: string; valueType: AudienceValueType }[]
  values: { key: string; label: string }[]
}

/** Titre et texte d'un modèle de message (une langue). */
export interface AudiencePresetMessage {
  title: string
  body: string
}

/**
 * Audience prête du back : règle déjà construite (JSON du back, sans `kind` ni `id`) et un
 * modèle de message par code de langue (`fr`, `en`).
 */
export interface AudiencePreset {
  key: string
  label: string
  description: string
  rule: unknown
  messages: Record<string, AudiencePresetMessage>
}

export interface BroadcastRecipient {
  id: string
  displayName: string
  country: string | null
  language: string
  pushReachable: boolean
  signedUpAt: string
}

export interface BroadcastSegment {
  id: string
  name: string
  description: string | null
  rule: unknown
  /** -1 dans la liste : seul GET /{id} le calcule. */
  recipientCount: number
  updatedAt: string
}

export interface BroadcastRecipientPage {
  content: BroadcastRecipient[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface BroadcastSegmentPage {
  content: BroadcastSegment[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface AdminBroadcast {
  id: string
  title: string
  body: string
  targetType: BroadcastTargetType
  targetOrigin: string | null
  targetDestination: string | null
  targetUserId: string | null
  recipientCount: number
  adminId: string
  createdAt: string
  /** Règle figée au moment de l'envoi (JSON du back) ; null pour un ancien envoi. */
  audienceRule?: unknown
  segmentId?: string | null
  segmentName?: string | null
}

export interface AdminBroadcastPage {
  content: AdminBroadcast[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface BroadcastAudience {
  recipientCount: number
  /** Parmi eux, ceux qui ont au moins un appareil joignable par push. */
  pushReachableCount: number
  /** Cible USER : nom du compte visé (nouveau back, NON_NULL), pour vérifier avant l'envoi. */
  targetUserName?: string | null
  /**
   * Cible USER : false si le compte ne recevra rien (banni, suppression demandée, supprimé).
   * Absent d'un ancien back : on ne bloque pas.
   */
  targetUserReachable?: boolean | null
}

export const TARGET_LABELS: Record<BroadcastTargetType, string> = {
  ALL: 'Tous les comptes actifs',
  SENDERS: 'Expéditeurs (ont déjà fait une demande)',
  TRAVELERS: 'Voyageurs (ont déjà publié un trajet)',
  CORRIDOR: 'Corridor (ville de départ → ville d’arrivée)',
  USER: 'Un utilisateur précis',
  RULE: 'Audience sur mesure (règles)',
}
