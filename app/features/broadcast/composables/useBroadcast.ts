import { ref } from 'vue'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminBroadcast, BroadcastTarget } from '@/features/broadcast/types/index'

const PAGE_SIZE = 20

/**
 * 404 sur une cible USER = compte inconnu. Le `detail` du back prime ; un 404 sans detail
 * (proxy, ancien back) reçoit un message clair plutôt que « 404 Not Found ».
 */
function broadcastError(e: unknown, fallback: string): string {
  const err = e as { statusCode?: number; status?: number; data?: { detail?: unknown } } | undefined
  const status = err?.statusCode ?? err?.status
  const detail = err?.data?.detail
  if (status === 404 && !(typeof detail === 'string' && detail.trim())) return 'Utilisateur introuvable : vérifiez l’identifiant.'
  return extractProblemMessage(e, fallback)
}

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
  const targetUserName = ref<string | null>(null)
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
      const audience = await broadcastService.preview(target)
      targetUserName.value = audience.targetUserName ?? null
      recipientCount.value = audience.recipientCount
    } catch (e) {
      recipientCount.value = null
      targetUserName.value = null
      error.value = broadcastError(e, 'Impossible d’estimer le nombre de destinataires')
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
      targetUserName.value = null
      await fetchHistory()
    } catch (e) {
      error.value = broadcastError(e, 'Envoi impossible')
    } finally {
      busy.value = false
    }
  }

  return {
    history, isLoading, busy, previewing, error, recipientCount, targetUserName, currentPage, totalPages,
    fetchHistory, goToPage, preview, send,
  }
}
