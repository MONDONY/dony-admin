export interface AdminConversation {
  id: string
  bidId: string | null
  participantA: string | null
  participantB: string | null
  lastMessageAt: string | null
  messageCount: number
  flagged: boolean
  createdAt: string
  /** `SENDER_TRAVELER` ou `RECIPIENT_TRAVELER` ; absent sur un ancien back. */
  kind?: string | null
  /** Conversation destinataire fermée après un changement de destinataire. */
  closedAt?: string | null
  /**
   * Identifiant INTERNE de la conversation : celui que porte `targetId` d'un signalement de message (l'`id`
   * ci-dessus est l'identifiant Firestore). Absent sur un back plus ancien (yadony-back #667).
   */
  conversationId?: string | null
  /** Comptes des deux participants (mêmes rôles que `participantA`/`participantB`). */
  participantAId?: string | null
  participantBId?: string | null
  /** Signalements ouverts sur un message de cette conversation ; `flagged` en dépend. */
  openReportCount?: number
  /** Aperçu du dernier message, tel que l'app l'écrit dans Firestore. */
  lastMessagePreview?: string | null
}

export interface AdminMessage {
  id: string
  conversationId: string
  senderName: string | null
  content: string
  flagged: boolean
  deleted: boolean
  /** Nouveau back (NON_NULL) : date de suppression, et `true` si un admin l'a supprimé. */
  deletedAt?: string | null
  deletedByAdmin?: boolean
  /** `TEXT` ou `IMAGE` ; absent sur un ancien back. */
  type?: string
  /** Photo (URL présignée, 15 min) et sa vignette ; null si purgée ou absente. */
  imageUrl?: string | null
  thumbUrl?: string | null
  createdAt: string
}

export interface AdminConversationPage {
  content: AdminConversation[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

/** GET /admin/conversations/{id}/context (yadony-back #667). */
export interface ConversationHistoryEntry {
  /** Code d'audit : MESSAGE_ADMIN_DELETED, MESSAGE_ADMIN_RESTORED, CONVERSATION_NOTE_ADDED. */
  action: string
  detail?: string | null
  at?: string | null
  actorEmail?: string | null
  /** Motif saisi par l'administrateur (suppression, restauration). */
  note?: string | null
}

export interface ConversationNote {
  id: string
  adminEmail: string | null
  content: string
  createdAt: string
}

export interface ConversationLinkedReport {
  id: string
  reason: string | null
  status: string | null
  reporterName: string | null
  createdAt: string | null
}

export interface ConversationParticipant {
  userId: string | null
  displayName: string | null
  /** A : expéditeur (ou destinataire) ; B : voyageur. */
  role: 'A' | 'B' | string
}

export interface ConversationContext {
  history: ConversationHistoryEntry[]
  notes: ConversationNote[]
  reports: ConversationLinkedReport[]
  participants: ConversationParticipant[]
}

export interface ConversationQuery {
  /** Seulement les conversations qui ont un signalement ouvert sur un message. */
  flagged?: boolean
  /** Nom d'un participant (2 caractères au moins). */
  q?: string
}
