/**
 * ⚠️ Le ciblage est comportemental côté back : `SENDERS` = a créé au moins un bid,
 * `TRAVELERS` = a publié au moins une annonce. Ce n'est PAS un filtre par rôle — tout
 * compte porte SENDER et TRAVELER depuis la migration V193, un filtre par rôle enverrait
 * donc à tout le monde dans les deux cas.
 */
export type BroadcastTargetType = 'ALL' | 'SENDERS' | 'TRAVELERS' | 'CORRIDOR' | 'USER'

export interface BroadcastTarget {
  type: BroadcastTargetType
  /** Ville de départ — obligatoire, et seulement, pour `CORRIDOR`. */
  origin?: string
  /** Ville d'arrivée — obligatoire, et seulement, pour `CORRIDOR`. */
  destination?: string
  /** Obligatoire, et seulement, pour `USER`. */
  userId?: string
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
}

export const TARGET_LABELS: Record<BroadcastTargetType, string> = {
  ALL: 'Tous les comptes actifs',
  SENDERS: 'Expéditeurs (ont déjà fait une demande)',
  TRAVELERS: 'Voyageurs (ont déjà publié un trajet)',
  CORRIDOR: 'Corridor (ville de départ → ville d’arrivée)',
  USER: 'Un utilisateur précis',
}
