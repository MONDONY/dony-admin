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
}

export interface AdminSupportTicketPage {
  content: AdminSupportTicket[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
