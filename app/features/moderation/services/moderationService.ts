import { useApi } from '@/composables/useApi'
import type { AdminConversationPage, AdminMessage } from '@/features/moderation/types/index'

export const moderationService = {
  /** Pas de filtre « signalées » : le back n'en connaît pas, les signalements ouverts viennent de `/admin/reports`. */
  listConversations(page: number, size: number): Promise<AdminConversationPage> {
    return useApi()<AdminConversationPage>('/admin/conversations', { query: { page, size } })
  },
  getMessages(conversationId: string): Promise<AdminMessage[]> {
    return useApi()<AdminMessage[]>(`/admin/conversations/${encodeURIComponent(conversationId)}/messages`)
  },
  /**
   * Le motif part en paramètre de requête (un DELETE ne porte pas de corps fiable), omis s'il est
   * vide : un back qui ne le lit pas encore l'ignore sans erreur.
   */
  deleteMessage(conversationId: string, messageId: string, reason?: string): Promise<void> {
    const url = `/admin/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`
    const trimmed = reason?.trim()
    if (!trimmed) return useApi()<void>(url, { method: 'DELETE' })
    return useApi()<void>(url, { method: 'DELETE', query: { reason: trimmed } })
  },
  /**
   * Restaure un message supprimé par un admin (MESSAGE_DELETE). Peut ne pas exister : le back
   * ne l'expose que s'il conserve le contenu supprimé (404/405 sans code sinon). Répond 204
   * sans corps : la conversation se relit ensuite.
   */
  restoreMessage(conversationId: string, messageId: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/restore`, {
      method: 'POST',
      body: { reason },
    })
  },
}
