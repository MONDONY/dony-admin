import { useApi } from '@/composables/useApi'
import type { AdminConversationPage, AdminMessage, ModerationFilterState } from '@/features/moderation/types/index'

function buildQuery(f: ModerationFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.flaggedOnly) q.flagged = true
  return q
}

export const moderationService = {
  listConversations(filters: ModerationFilterState, page: number, size: number): Promise<AdminConversationPage> {
    return useApi()<AdminConversationPage>('/admin/conversations', { query: buildQuery(filters, page, size) })
  },
  getMessages(conversationId: string): Promise<AdminMessage[]> {
    return useApi()<AdminMessage[]>(`/admin/conversations/${conversationId}/messages`)
  },
  deleteMessage(conversationId: string, messageId: string): Promise<void> {
    return useApi()<void>(`/admin/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' })
  },
  /**
   * Restaure un message supprimé par un admin (MESSAGE_DELETE). Peut ne pas exister : le back
   * ne l'expose que s'il conserve le contenu supprimé (404/405 sans code sinon). Répond 204
   * sans corps : la conversation se relit ensuite.
   */
  restoreMessage(conversationId: string, messageId: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/conversations/${conversationId}/messages/${messageId}/restore`, {
      method: 'POST',
      body: { reason },
    })
  },
}
