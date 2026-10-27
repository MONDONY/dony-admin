import { computed, ref } from 'vue'
import { moderationService } from '@/features/moderation/services/moderationService'
import { buildQueue } from '@/features/moderation/lib/moderationWorkbench'
import type { AdminConversation } from '@/features/moderation/types/index'
import { reportsService } from '@/features/signalements/services/reportsService'
import type { AdminReport } from '@/features/signalements/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { useAuthStore } from '@/stores/auth'

/** Taille de la page de conversations chargée : la file se filtre et se cherche sur celles-ci. */
export const CONVERSATION_PAGE_SIZE = 100

/**
 * File de modération : les conversations les plus récentes, croisées avec les signalements ouverts sur
 * un message. Les signalements se lisent avec REPORT_VIEW ; sans ce droit, ou si leur lecture échoue,
 * la file reste utilisable sans l'indication « signalée » (`reportsUnavailable`).
 */
export function useModerationQueue() {
  const auth = useAuthStore()
  const conversations = ref<AdminConversation[]>([])
  const reports = ref<AdminReport[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalElements = ref(0)
  const reportsUnavailable = ref(false)

  const items = computed(() => buildQueue(conversations.value, reports.value))
  /** Il existe des conversations plus anciennes que celles chargées. */
  const truncated = computed(() => totalElements.value > conversations.value.length)

  async function readReports(): Promise<AdminReport[]> {
    if (!auth.can('REPORT_VIEW')) return []
    try {
      const page = await reportsService.list({ status: 'OPEN', targetType: 'MESSAGE' }, 0, CONVERSATION_PAGE_SIZE)
      reportsUnavailable.value = false
      return Array.isArray(page?.content) ? page.content : []
    } catch {
      reportsUnavailable.value = true
      return []
    }
  }

  async function fetchQueue() {
    isLoading.value = true
    error.value = null
    try {
      const [page, open] = await Promise.all([moderationService.listConversations(0, CONVERSATION_PAGE_SIZE), readReports()])
      conversations.value = page.content
      totalElements.value = page.totalElements ?? page.content.length
      reports.value = open
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les conversations')
    } finally {
      isLoading.value = false
    }
  }

  return { items, isLoading, error, truncated, reportsUnavailable, fetchQueue }
}
