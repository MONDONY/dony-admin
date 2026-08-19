import { ref } from 'vue'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminBroadcast, BroadcastTarget } from '@/features/broadcast/types/index'

const PAGE_SIZE = 20

/**
 * Rédaction, aperçu et historique des broadcasts.
 *
 * Le back répond 202 : la diffusion n'a pas encore eu lieu quand la promesse se résout.
 * On recharge donc l'historique (la ligne y est déjà, avec son compteur figé) mais on
 * n'affiche jamais « tout le monde a reçu le message ».
 */
export function useBroadcast() {
  const history = ref<AdminBroadcast[]>([])
  const isLoading = ref(false)
  const busy = ref(false)
  const previewing = ref(false)
  const error = ref<string | null>(null)
  const recipientCount = ref<number | null>(null)
  const currentPage = ref(0)
  const totalPages = ref(0)

  async function fetchHistory() {
    isLoading.value = true
    error.value = null
    try {
      const page = await broadcastService.listHistory(currentPage.value, PAGE_SIZE)
      history.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger l’historique des envois')
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) {
    currentPage.value = p
    await fetchHistory()
  }

  async function preview(target: BroadcastTarget) {
    previewing.value = true
    error.value = null
    try {
      recipientCount.value = (await broadcastService.preview(target)).recipientCount
    } catch (e) {
      recipientCount.value = null
      error.value = extractProblemMessage(e, 'Impossible d’estimer le nombre de destinataires')
    } finally {
      previewing.value = false
    }
  }

  async function send(title: string, body: string, target: BroadcastTarget) {
    busy.value = true
    error.value = null
    try {
      await broadcastService.send(title, body, target)
      recipientCount.value = null
      await fetchHistory()
    } catch (e) {
      error.value = extractProblemMessage(e, 'Envoi impossible')
    } finally {
      busy.value = false
    }
  }

  return {
    history, isLoading, busy, previewing, error, recipientCount, currentPage, totalPages,
    fetchHistory, goToPage, preview, send,
  }
}
