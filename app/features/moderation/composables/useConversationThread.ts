import { ref } from 'vue'
import { moderationService } from '@/features/moderation/services/moderationService'
import type { AdminMessage } from '@/features/moderation/types/index'

export function useConversationThread() {
  const activeId = ref<string | null>(null)
  const messages = ref<AdminMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    if (!activeId.value) return
    isLoading.value = true
    error.value = null
    try {
      messages.value = await moderationService.getMessages(activeId.value)
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function open(conversationId: string) {
    activeId.value = conversationId
    await load()
  }

  function close() {
    activeId.value = null
    messages.value = []
    error.value = null
  }

  async function deleteMessage(id: string) {
    if (!activeId.value) return
    await moderationService.deleteMessage(activeId.value, id)
    await load()
  }

  return { activeId, messages, isLoading, error, open, close, deleteMessage }
}
