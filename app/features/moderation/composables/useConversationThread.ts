import { ref } from 'vue'
import { moderationService } from '@/features/moderation/services/moderationService'
import type { AdminMessage } from '@/features/moderation/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { reasonViolationMessage } from '@/lib/restoreReason'

export function useConversationThread() {
  const activeId = ref<string | null>(null)
  const messages = ref<AdminMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Messages dont la restauration a répondu 404/405 sans code : bouton masqué pour eux. */
  const restoreUnavailableIds = ref<string[]>([])
  const restoreError = ref<string | null>(null)
  /** Motif refusé (422 `violations`) : affiché dans le dialogue, saisie conservée. */
  const restoreReasonError = ref<string | null>(null)
  const deleteError = ref<string | null>(null)

  /** Une lecture plus récente a été lancée : la réponse de la précédente n'est plus la bonne conversation. */
  let reads = 0

  async function load() {
    const id = activeId.value
    if (!id) return
    const mine = ++reads
    isLoading.value = true
    error.value = null
    try {
      const list = await moderationService.getMessages(id)
      if (mine === reads) messages.value = list
    } catch (e) {
      if (mine === reads) error.value = extractProblemMessage(e, 'Impossible de charger la conversation')
    } finally {
      if (mine === reads) isLoading.value = false
    }
  }

  async function open(conversationId: string) {
    activeId.value = conversationId
    messages.value = []
    restoreUnavailableIds.value = []
    restoreError.value = null
    restoreReasonError.value = null
    deleteError.value = null
    await load()
  }

  function close() {
    reads += 1
    isLoading.value = false
    activeId.value = null
    messages.value = []
    error.value = null
    restoreUnavailableIds.value = []
    restoreError.value = null
    restoreReasonError.value = null
    deleteError.value = null
  }

  /** Rend true si le message est supprimé (puis la conversation relue). */
  async function deleteMessage(id: string, reason?: string): Promise<boolean> {
    if (!activeId.value) return false
    deleteError.value = null
    try {
      await moderationService.deleteMessage(activeId.value, id, reason)
    } catch (e) {
      deleteError.value = extractProblemMessage(e, 'Impossible de supprimer ce message')
      return false
    }
    await load()
    return true
  }

  /** Rend true si le message est restauré (puis la conversation relue). */
  async function restoreMessage(id: string, reason: string): Promise<boolean> {
    if (!activeId.value) return false
    restoreError.value = null
    restoreReasonError.value = null
    try {
      await moderationService.restoreMessage(activeId.value, id, reason)
    } catch (e) {
      const invalid = reasonViolationMessage(e)
      if (invalid) {
        restoreReasonError.value = invalid
      } else if (isEndpointMissing(e)) {
        if (!restoreUnavailableIds.value.includes(id)) restoreUnavailableIds.value = [...restoreUnavailableIds.value, id]
      } else {
        restoreError.value = extractProblemMessage(e, 'Impossible de restaurer ce message')
      }
      return false
    }
    await load()
    return true
  }

  return {
    activeId, messages, isLoading, error, restoreUnavailableIds, restoreError, restoreReasonError, deleteError,
    open, load, close, deleteMessage, restoreMessage,
  }
}
