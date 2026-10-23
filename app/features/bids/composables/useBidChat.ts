import { ref, toValue, type MaybeRefOrGetter } from 'vue'
import { moderationService } from '@/features/moderation/services/moderationService'
import type { AdminMessage } from '@/features/moderation/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Messages de la conversation d'un colis (lecture seule). Chargés une fois par conversation
 * (`reload` pour forcer, par exemple quand une photo présignée a expiré) ; une conversation
 * différente repart de zéro. Seule la dernière réponse compte.
 */
export function useBidChat(conversationId: MaybeRefOrGetter<string>) {
  const messages = ref<AdminMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let seq = 0
  let loadedFor: string | null = null
  let pending: Promise<void> | null = null

  async function fetchMessages(id: string): Promise<void> {
    const my = ++seq
    loadedFor = id
    isLoading.value = true
    error.value = null
    try {
      const res = await moderationService.getMessages(id)
      if (my !== seq) return
      messages.value = res
    } catch (e) {
      if (my !== seq) return
      error.value = extractProblemMessage(e, 'Impossible de charger la conversation')
      loadedFor = null
    } finally {
      if (my === seq) { isLoading.value = false; pending = null }
    }
  }

  function start(id: string): Promise<void> {
    pending = fetchMessages(id)
    return pending
  }

  /** Charge la conversation, sauf si c'est déjà fait (ou en cours) pour cet identifiant. */
  function load(): Promise<void> {
    const id = toValue(conversationId)
    if (loadedFor === id) return pending ?? Promise.resolve()
    if (loadedFor !== null) messages.value = []
    return start(id)
  }

  /** Relit la conversation (nouvelles URL présignées). */
  function reload(): Promise<void> {
    return start(toValue(conversationId))
  }

  return { messages, isLoading, error, load, reload }
}
