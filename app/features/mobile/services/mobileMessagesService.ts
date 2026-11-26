import { useApi } from '@/composables/useApi'
import type { AdminConversationPage, AdminMessage, ConversationContext, ConversationQuery } from '@/features/moderation/types/index'

/**
 * Lecture seule des conversations pour le mobile. Volontairement distinct du service de modération du poste ordinateur :
 * aucune suppression, restauration ni note n'est joignable depuis les écrans mobiles.
 */
export const mobileMessagesService = {
  listConversations(page: number, size: number, filters: ConversationQuery = {}): Promise<AdminConversationPage> {
    const query: Record<string, string | number | boolean> = { page, size }
    if (filters.flagged) query.flagged = true
    const q = filters.q?.trim()
    if (q) query.q = q
    return useApi()<AdminConversationPage>('/admin/conversations', { query })
  },
  getMessages(conversationId: string): Promise<AdminMessage[]> {
    return useApi()<AdminMessage[]>(`/admin/conversations/${encodeURIComponent(conversationId)}/messages`)
  },
  getContext(conversationId: string): Promise<ConversationContext> {
    return useApi()<ConversationContext>(`/admin/conversations/${encodeURIComponent(conversationId)}/context`)
  },
}
