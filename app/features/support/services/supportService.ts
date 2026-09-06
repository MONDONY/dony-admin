import { useApi } from '@/composables/useApi'
import type {
  AdminSupportTicket, AdminSupportTicketPage, SupportMessage, SupportStatusFilter, SupportTicketScope,
} from '@/features/support/types/index'

function buildQuery(
  scope: SupportTicketScope,
  status: SupportStatusFilter,
  page: number,
  size: number,
): Record<string, string | number> {
  const q: Record<string, string | number> = { scope, page, size }
  if (status !== 'TOUS') q.status = status
  return q
}

export const supportService = {
  list(
    scope: SupportTicketScope,
    status: SupportStatusFilter,
    page: number,
    size: number,
  ): Promise<AdminSupportTicketPage> {
    return useApi()<AdminSupportTicketPage>('/admin/support/tickets', {
      query: buildQuery(scope, status, page, size),
    })
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
  /** Répondre — réservé à l'admin assigné (409 sinon). Renvoie le message créé. */
  reply(id: string, content: string): Promise<SupportMessage> {
    return useApi()<SupportMessage>(`/admin/support/tickets/${id}/messages`, {
      method: 'POST',
      body: { content },
    })
  },
  /** Résoudre — définitif, pas de réouverture. */
  resolve(id: string): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>(`/admin/support/tickets/${id}/resolve`, { method: 'POST' })
  },
}
