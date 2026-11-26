import { useApi } from '@/composables/useApi'
import type { AdminSupportTicket, AdminSupportTicketPage, SupportMessage, SupportStatusFilter } from '@/features/support/types/index'

/**
 * Support depuis le mobile : lister, lire, répondre (texte seul), prendre en charge un billet libre.
 * Volontairement distinct du service du poste ordinateur : ni résolution, ni réassignation, ni pièce
 * jointe, ni note, ni modèle de réponse, ni ouverture de conversation n'est joignable ici.
 */
export const mobileSupportService = {
  list(status: SupportStatusFilter, page: number, size: number): Promise<AdminSupportTicketPage> {
    const query: Record<string, string | number> = { scope: 'all', page, size }
    if (status !== 'TOUS') query.status = status
    return useApi()<AdminSupportTicketPage>('/admin/support/tickets', { query })
  },
  get(id: string): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>(`/admin/support/tickets/${encodeURIComponent(id)}`)
  },
  /** Réservé à l'admin assigné (409 sinon). Sans pièce jointe. */
  reply(id: string, content: string): Promise<SupportMessage> {
    return useApi()<SupportMessage>(`/admin/support/tickets/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      body: { content, attachmentKeys: [] },
    })
  },
  /** S'assigner un billet libre. 409 s'il vient d'être pris par un collègue. */
  assign(id: string): Promise<AdminSupportTicket> {
    return useApi()<AdminSupportTicket>(`/admin/support/tickets/${encodeURIComponent(id)}/assign`, { method: 'POST' })
  },
}
