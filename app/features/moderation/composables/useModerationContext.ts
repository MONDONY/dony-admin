import { moderationService } from '@/features/moderation/services/moderationService'
import type { ConversationContext } from '@/features/moderation/types/index'
import { useContextLoader } from '@/features/signalements/composables/useContextLoader'

/**
 * Une vraie réponse porte toujours `history` et `notes` (listes, jamais nulles donc jamais omises par le
 * back). Toute autre forme (proxy, ancien back) n'est pas un contexte de conversation.
 */
export function isConversationContext(value: unknown): value is ConversationContext {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { history?: unknown; notes?: unknown }
  return Array.isArray(v.history) && Array.isArray(v.notes)
}

/** Historique de modération et notes de la conversation ouverte (courses, ancien back : voir `useContextLoader`). */
export function useModerationContext() {
  return useContextLoader<ConversationContext>((id) => moderationService.getContext(id), isConversationContext)
}
