import { reactive, ref } from 'vue'
import { moderationService } from '@/features/moderation/services/moderationService'
import type { AdminConversation, ModerationFilterState } from '@/features/moderation/types/index'

export function useConversations() {
  const conversations = ref<AdminConversation[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<ModerationFilterState>({ flaggedOnly: false })

  async function fetchConversations() {
    isLoading.value = true
    error.value = null
    try {
      const page = await moderationService.listConversations(filters, currentPage.value, pageSize.value)
      conversations.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchConversations() }
  async function setFlaggedOnly(v: boolean) { filters.flaggedOnly = v; currentPage.value = 0; await fetchConversations() }

  return { conversations, isLoading, error, totalPages, currentPage, pageSize, filters, fetchConversations, goToPage, setFlaggedOnly }
}
