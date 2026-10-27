import { computed, ref } from 'vue'
import { moderationService } from '@/features/moderation/services/moderationService'
import { buildQueue, flagsSupported, mergeConversations } from '@/features/moderation/lib/moderationWorkbench'
import type { AdminConversation } from '@/features/moderation/types/index'
import { reportsService } from '@/features/signalements/services/reportsService'
import type { AdminReport } from '@/features/signalements/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { useAuthStore } from '@/stores/auth'

/** Taille de la page de conversations chargée : la file se filtre et se cherche sur celles-ci. */
export const CONVERSATION_PAGE_SIZE = 100

/**
 * File de modération : les conversations les plus récentes, plus celles qui ont un signalement ouvert (le
 * serveur les connaît, même anciennes), croisées avec le détail des signalements (motif, signalant, âge).
 * Les conversations signalées viennent du serveur ; le détail des signalements se lit avec REPORT_VIEW et
 * son absence (droit, panne) n'empêche jamais la file : on perd seulement le motif et l'âge.
 *
 * `fetchQueue({ q })` cherche un participant par nom côté serveur (au-delà de la page récente).
 */
export function useModerationQueue() {
  const auth = useAuthStore()
  const conversations = ref<AdminConversation[]>([])
  const reports = ref<AdminReport[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalElements = ref(0)
  const reportsUnavailable = ref(false)
  /** Dernière lecture lancée : une réponse plus ancienne (frappe rapide dans la recherche) est écartée. */
  let reads = 0

  const items = computed(() => buildQueue(conversations.value, reports.value))
  /** Il existe des conversations plus anciennes que celles chargées. */
  const truncated = computed(() => totalElements.value > conversations.value.length)
  /** Ancien back : il ne rapproche pas les signalements des conversations, aucune n'y est « signalée ». */
  const flagsUnsupported = computed(() => !flagsSupported(conversations.value))

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

  /** Les conversations signalées : sans elles, une conversation ancienne avec un signalement manquerait à la file. */
  async function readFlagged(): Promise<AdminConversation[]> {
    try {
      const page = await moderationService.listConversations(0, CONVERSATION_PAGE_SIZE, { flagged: true })
      return Array.isArray(page?.content) ? page.content : []
    } catch {
      return []
    }
  }

  async function fetchQueue({ q }: { q?: string } = {}) {
    const mine = ++reads
    isLoading.value = true
    error.value = null
    const search = q?.trim() ?? ''
    try {
      const [page, flagged, open] = await Promise.all([
        moderationService.listConversations(0, CONVERSATION_PAGE_SIZE, search ? { q: search } : {}),
        // Une recherche rend déjà les conversations signalées qui correspondent : pas de seconde lecture.
        search ? Promise.resolve([] as AdminConversation[]) : readFlagged(),
        readReports(),
      ])
      if (mine !== reads) return
      conversations.value = mergeConversations(page.content, flagged)
      totalElements.value = page.totalElements ?? page.content.length
      reports.value = open
    } catch (e) {
      if (mine === reads) error.value = extractProblemMessage(e, 'Impossible de charger les conversations')
    } finally {
      if (mine === reads) isLoading.value = false
    }
  }

  return { items, isLoading, error, truncated, reportsUnavailable, flagsUnsupported, fetchQueue }
}
