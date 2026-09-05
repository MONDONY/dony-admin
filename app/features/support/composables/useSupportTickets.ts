import { ref } from 'vue'
import { supportService } from '@/features/support/services/supportService'
import type {
  AdminSupportTicket, SupportStatusFilter, SupportTicketScope,
} from '@/features/support/types/index'

/**
 * File support : liste par onglet (non assignés / mes tickets / tous) et
 * détail sélectionné. Après chaque action (assign/reply/resolve), la liste
 * ET le détail sont rechargés : le serveur fait foi, notamment pour les 409
 * de garde (ticket pris par un collègue entre-temps).
 */
export function useSupportTickets() {
  const tickets = ref<AdminSupportTicket[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalElements = ref(0)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const scope = ref<SupportTicketScope>('unassigned')
  const statusFilter = ref<SupportStatusFilter>('TOUS')

  const selected = ref<AdminSupportTicket | null>(null)
  const isDetailLoading = ref(false)
  const isActing = ref(false)
  const actionError = ref<string | null>(null)

  async function fetchTickets() {
    isLoading.value = true
    error.value = null
    try {
      const page = await supportService.list(
        scope.value, statusFilter.value, currentPage.value, pageSize.value,
      )
      tickets.value = page.content
      totalElements.value = page.totalElements
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function setScope(s: SupportTicketScope) {
    scope.value = s
    currentPage.value = 0
    await fetchTickets()
  }

  async function setStatusFilter(s: SupportStatusFilter) {
    statusFilter.value = s
    currentPage.value = 0
    await fetchTickets()
  }

  async function goToPage(p: number) {
    currentPage.value = p
    await fetchTickets()
  }

  async function openTicket(id: string) {
    isDetailLoading.value = true
    actionError.value = null
    try {
      selected.value = await supportService.get(id)
    } catch (e) {
      actionError.value = (e as Error).message
    } finally {
      isDetailLoading.value = false
    }
  }

  function closeTicket() {
    selected.value = null
    actionError.value = null
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
      actionError.value = (e as Error).message
      return false
    } finally {
      isActing.value = false
    }
  }

  const assign = (id: string) => act(id, () => supportService.assign(id))
  const reassign = (id: string, adminId: string) =>
    act(id, () => supportService.reassign(id, adminId))
  const reply = (id: string, content: string) =>
    act(id, () => supportService.reply(id, content))
  const resolve = (id: string) => act(id, () => supportService.resolve(id))

  return {
    tickets, isLoading, error, totalElements, totalPages, currentPage, pageSize,
    scope, statusFilter, selected, isDetailLoading, isActing, actionError,
    fetchTickets, setScope, setStatusFilter, goToPage,
    openTicket, closeTicket, assign, reassign, reply, resolve,
  }
}
