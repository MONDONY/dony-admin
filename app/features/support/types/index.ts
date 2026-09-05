/** Miroir des enums backend SupportTicketStatus / SupportTicketScope. */
export type SupportTicketStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'WAITING_USER'
  | 'WAITING_SUPPORT'
  | 'RESOLVED'

export type SupportTicketScope = 'unassigned' | 'mine' | 'all'

export type SupportStatusFilter = SupportTicketStatus | 'TOUS'

export interface SupportMessage {
  id: string
  authorType: 'USER' | 'ADMIN'
  content: string
  createdAt: string
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
}

export interface AdminSupportTicketPage {
  content: AdminSupportTicket[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
