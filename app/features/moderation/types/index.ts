export interface AdminConversation {
  id: string
  bidId: string | null
  participantA: string | null
  participantB: string | null
  lastMessageAt: string | null
  messageCount: number
  flagged: boolean
  createdAt: string
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
  createdAt: string
}

export interface AdminConversationPage {
  content: AdminConversation[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface ModerationFilterState {
  flaggedOnly: boolean
}
