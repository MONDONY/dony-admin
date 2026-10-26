/** Miroir des enums backend SupportTicketStatus / SupportTicketScope. */
export type SupportTicketStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'WAITING_USER'
  | 'WAITING_SUPPORT'
  | 'RESOLVED'

export type SupportTicketScope = 'unassigned' | 'mine' | 'all'

/** Miroir de l'enum backend SupportCategory. */
export type SupportCategory = 'ACCOUNT' | 'KYC' | 'PAYMENT' | 'TRIP' | 'PACKAGE' | 'DELIVERY' | 'OTHER'

/** Corps de POST /admin/support/tickets : conversation ouverte par l'admin. */
export interface StartSupportTicketPayload {
  userId: string
  category: SupportCategory
  subject: string
  /** Facultatif si au moins une image est jointe (le back exige texte OU pièce jointe). */
  message: string | null
  attachmentKeys: string[]
}

export type SupportStatusFilter = SupportTicketStatus | 'TOUS'

export interface AdminSupportAttachment {
  id: string
  url: string
  contentType: string
}

export interface SupportMessage {
  id: string
  authorType: 'USER' | 'ADMIN'
  content: string | null
  createdAt: string
  attachments?: AdminSupportAttachment[]
}

/**
 * Vue back-office d'un ticket (AdminSupportTicketResponse). En liste,
 * `messages` est null ; le détail porte le fil complet.
 */
export interface AdminSupportTicket {
  id: string
  category: string
  subject: string
  status: SupportTicketStatus
  priority: string
  userId: string
  userDisplayName: string
  assignedAdminId: string | null
  assignedAdminEmail: string | null
  createdAt: string
  lastMessageAt: string
  resolvedAt: string | null
  messages: SupportMessage[] | null
  /** Signalement (rapport de bug) dont la conversation est issue ; absent sur un ancien back. */
  sourceReportId?: string | null
  /** Aperçu du dernier message et son auteur (liste seulement, back #660) ; absents sur un ancien back. */
  lastMessagePreview?: string | null
  lastMessageAuthor?: 'USER' | 'ADMIN' | null
}

export type SupportPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

/** Geste tracé dans l'audit d'un ticket (du plus récent au plus ancien). */
export interface SupportHistoryEntry {
  action: string
  /** Nouvelle priorité pour un changement de priorité. */
  detail?: string | null
  at?: string | null
  actorEmail?: string | null
  note?: string | null
}
/** Note interne d'un agent : vue des seuls administrateurs. */
export interface SupportNote {
  id: string
  adminEmail: string | null
  content: string
  createdAt: string
}
/** `GET /admin/support/tickets/{id}/context` (back #660). */
export interface SupportContext { history: SupportHistoryEntry[]; notes: SupportNote[] }

/** Réponse type d'un agent (`/admin/support/reply-templates`, back #660). */
export interface SupportReplyTemplate { id: string; label: string; content: string; sortOrder: number }

export interface AdminSupportTicketPage {
  content: AdminSupportTicket[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
