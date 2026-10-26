import { ref } from 'vue'
import { supportService } from '@/features/support/services/supportService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminSupportTicket } from '@/features/support/types/index'

/** Une page : les 100 conversations les plus récentes. Périmètre, recherche et filtres se font sur cette page. */
export const SUPPORT_PAGE_SIZE = 100

/**
 * File support : toutes les conversations (une page), et le détail sélectionné. Après chaque action
 * (assign/reply/resolve), la liste ET le détail sont rechargés : le serveur fait foi, notamment pour les
 * 409 de garde (ticket pris par un collègue entre-temps).
 */
export function useSupportTickets() {
  const tickets = ref<AdminSupportTicket[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Le serveur a plus de conversations que la page chargée. */
  const truncated = ref(false)
  /** Filtre ?userId= : les conversations d'un seul utilisateur. */
  const userId = ref<string | null>(null)
  /** L'ancien back ignore ?userId= : des tickets d'autres comptes ont dû être écartés ici. */
  const userFilterIgnored = ref(false)

  const selected = ref<AdminSupportTicket | null>(null)
  const isDetailLoading = ref(false)
  const isActing = ref(false)
  const actionError = ref<string | null>(null)
  let openCount = 0

  async function fetchTickets() {
    isLoading.value = true
    error.value = null
    try {
      const filter = userId.value
      const page = filter
        ? await supportService.list('all', 'TOUS', 0, SUPPORT_PAGE_SIZE, filter)
        : await supportService.list('all', 'TOUS', 0, SUPPORT_PAGE_SIZE)
      // Une ligne sans userId ne peut pas être vérifiée : elle reste affichée.
      const kept = filter ? page.content.filter((t) => !t.userId || t.userId === filter) : page.content
      userFilterIgnored.value = kept.length < page.content.length
      tickets.value = kept
      truncated.value = page.totalElements > page.content.length
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les tickets')
    } finally {
      isLoading.value = false
    }
  }

  /** Poser ou retirer le filtre utilisateur ; avec userId le back renvoie tout l'historique du compte. */
  async function setUserFilter(id: string | null) {
    userId.value = id
    await fetchTickets()
  }

  /** Lit le fil d'un ticket ; deux ouvertures rapprochées (J / K) ne mélangent pas leurs réponses. */
  async function openTicket(id: string) {
    const mine = ++openCount
    isDetailLoading.value = true
    actionError.value = null
    try {
      const ticket = await supportService.get(id)
      if (mine === openCount) selected.value = ticket
    } catch (e) {
      if (mine === openCount) actionError.value = extractProblemMessage(e, 'Action impossible')
    } finally {
      if (mine === openCount) isDetailLoading.value = false
    }
  }

  function closeTicket() {
    openCount += 1
    selected.value = null
    actionError.value = null
    isDetailLoading.value = false
  }

  /** Recharge détail + liste après une mutation réussie. */
  async function refreshAfterAction(id: string) {
    selected.value = await supportService.get(id)
    await fetchTickets()
  }

  async function act(id: string, action: () => Promise<unknown>) {
    isActing.value = true
    actionError.value = null
    try {
      await action()
      await refreshAfterAction(id)
      return true
    } catch (e) {
      actionError.value = extractProblemMessage(e, 'Action impossible')
      return false
    } finally {
      isActing.value = false
    }
  }

  const assign = (id: string) => act(id, () => supportService.assign(id))
  const reassign = (id: string, adminId: string) =>
    act(id, () => supportService.reassign(id, adminId))
  const reply = (id: string, content: string, attachmentKeys: string[] = []) =>
    act(id, () => supportService.reply(id, content || null, attachmentKeys))
  const resolve = (id: string) => act(id, () => supportService.resolve(id))

  return {
    tickets, isLoading, error, truncated, userId, userFilterIgnored, selected, isDetailLoading, isActing, actionError,
    fetchTickets, setUserFilter, openTicket, closeTicket, assign, reassign, reply, resolve,
  }
}
