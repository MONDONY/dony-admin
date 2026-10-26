import { useApi } from '@/composables/useApi'
import type {
  AdminSupportTicket, AdminSupportTicketPage, StartSupportTicketPayload, SupportContext, SupportMessage, SupportNote,
  SupportPriority, SupportReplyTemplate, SupportStatusFilter, SupportTicketScope,
} from '@/features/support/types/index'

function buildQuery(
  scope: SupportTicketScope,
  status: SupportStatusFilter,
  page: number,
  size: number,
  userId?: string | null,
): Record<string, string | number> {
  const q: Record<string, string | number> = { scope, page, size }
  if (status !== 'TOUS') q.status = status
  if (userId) q.userId = userId
  return q
}

export const supportService = {
  list(
    scope: SupportTicketScope,
    status: SupportStatusFilter,
    page: number,
    size: number,
    /** Tickets d'un seul utilisateur. Un ancien back ignore ce paramètre. */
    userId?: string | null,
  ): Promise<AdminSupportTicketPage> {
    return useApi()<AdminSupportTicketPage>('/admin/support/tickets', {
      query: buildQuery(scope, status, page, size, userId),
    })
  },
  /** Les dernières conversations d'un utilisateur (fiche utilisateur). Avec userId, le back ignore scope. */
  listByUser(userId: string, size = 5): Promise<AdminSupportTicketPage> {
    return useApi()<AdminSupportTicketPage>('/admin/support/tickets', {
      query: { scope: 'all', userId, page: 0, size },
    })
  },
  /**
   * Ouvrir une conversation avec un utilisateur (premier message de l'admin, qui en devient
   * l'assigné). 404 `user-not-found`, 422 validation ; 404/405 sans code sur un ancien back.
   */
  startTicket(payload: StartSupportTicketPayload): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>('/admin/support/tickets', { method: 'POST', body: payload })
  },
  get(id: string): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>(`/admin/support/tickets/${id}`)
  },
  /** S'assigner le ticket. 409 backend s'il est déjà pris par un collègue. */
  assign(id: string): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>(`/admin/support/tickets/${id}/assign`, { method: 'POST' })
  },
  /** Réassigner à un autre admin (reprise explicite, tracée en audit). */
  reassign(id: string, adminId: string): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>(`/admin/support/tickets/${id}/reassign`, {
      method: 'POST',
      body: { adminId },
    })
  },
  /**
   * Envoyer une image en pièce jointe — multipart, champ `file`.
   * Requiert SUPPORT_TICKET_MANAGE. Renvoie { key, url }.
   */
  uploadAttachment(file: File): Promise<{ key: string; url: string }> {
    const form = new FormData()
    form.append('file', file)
    return useApi()<{ key: string; url: string }>('/admin/support/tickets/attachments', {
      method: 'POST',
      body: form,
    })
  },
  /** Répondre — réservé à l'admin assigné (409 sinon). Renvoie le message créé. */
  reply(id: string, content: string | null, attachmentKeys: string[] = []): Promise<SupportMessage> {
    return useApi()<SupportMessage>(`/admin/support/tickets/${id}/messages`, {
      method: 'POST',
      body: { content, attachmentKeys },
    })
  },
  /** Résoudre — définitif, pas de réouverture. */
  resolve(id: string): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>(`/admin/support/tickets/${id}/resolve`, { method: 'POST' })
  },
  /** Change la priorité d'un ticket ouvert (SUPPORT_TICKET_MANAGE). 404/405 sans code sur un ancien back. */
  setPriority(id: string, priority: SupportPriority): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>(`/admin/support/tickets/${id}/priority`, { method: 'POST', body: { priority } })
  },
  /** Historique tracé et notes internes du ticket (back #660) ; 404/405 sans code sur un ancien back. */
  getContext(id: string): Promise<SupportContext> {
    return useApi()<SupportContext>(`/admin/support/tickets/${id}/context`)
  },
  /** Note interne, 3 à 1000 caractères (422 `support-note-invalid` sinon). */
  addNote(id: string, content: string): Promise<SupportNote> {
    return useApi()<SupportNote>(`/admin/support/tickets/${id}/notes`, { method: 'POST', body: { content } })
  },
  listTemplates(): Promise<SupportReplyTemplate[]> {
    return useApi()<SupportReplyTemplate[]>('/admin/support/reply-templates')
  },
  createTemplate(label: string, content: string): Promise<SupportReplyTemplate> {
    return useApi()<SupportReplyTemplate>('/admin/support/reply-templates', { method: 'POST', body: { label, content } })
  },
  updateTemplate(id: string, label: string, content: string): Promise<SupportReplyTemplate> {
    return useApi()<SupportReplyTemplate>(`/admin/support/reply-templates/${id}`, { method: 'PUT', body: { label, content } })
  },
  deleteTemplate(id: string): Promise<void> {
    return useApi()<void>(`/admin/support/reply-templates/${id}`, { method: 'DELETE' })
  },
}
