import { useApi } from '@/composables/useApi'
import type { AdminConversationPage, AdminMessage, ConversationContext, ConversationNote, ConversationQuery } from '@/features/moderation/types/index'

export const moderationService = {
  /**
   * `flagged` et `q` sont lus par un back qui les connaît (yadony-back #667) ; un ancien back les ignore
   * (`flagged` lui rend une page vide, `q` toute la page).
   */
  listConversations(page: number, size: number, filters: ConversationQuery = {}): Promise<AdminConversationPage> {
    const query: Record<string, string | number | boolean> = { page, size }
    if (filters.flagged) query.flagged = true
    const q = filters.q?.trim()
    if (q) query.q = q
    return useApi()<AdminConversationPage>('/admin/conversations', { query })
  },
  /** Historique, notes, signalements et participants. 404/405 sans code sur un ancien back. */
  getContext(conversationId: string): Promise<ConversationContext> {
    return useApi()<ConversationContext>(`/admin/conversations/${encodeURIComponent(conversationId)}/context`)
  },
  /** Note interne (MESSAGE_DELETE), 3 à 1000 caractères : 201 avec la note créée. */
  addNote(conversationId: string, content: string): Promise<ConversationNote> {
    return useApi()<ConversationNote>(`/admin/conversations/${encodeURIComponent(conversationId)}/notes`, { method: 'POST', body: { content } })
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
