import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminGdprRequest } from '@/features/users/types/index'

const PAGE_SIZE = 20

/**
 * File des demandes de suppression RGPD, les plus anciennes d'abord (tri porté par le back).
 *
 * Un refus du back (escrow actif, solde wallet non vide) arrive en 422 avec un `detail`
 * lisible : on l'affiche tel quel et on NE recharge PAS la file — la demande est toujours
 * là, et un rechargement masquerait le message sans rien changer.
 */
export function useGdprRequests() {
  const requests = ref<AdminGdprRequest[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)
  const currentPage = ref(0)
  const totalPages = ref(0)

  async function fetchRequests() {
    isLoading.value = true
    error.value = null
    try {
      const page = await usersService.listGdprRequests(currentPage.value, PAGE_SIZE)
      requests.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les demandes RGPD')
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) {
    currentPage.value = p
    await fetchRequests()
  }

  async function execute(id: string, reason: string) {
    error.value = null
    busy.value = true
    try {
      await usersService.executeGdprDeletion(id, reason)
      await fetchRequests()
    } catch (e) {
      error.value = extractProblemMessage(e, 'Suppression impossible')
    } finally {
      busy.value = false
    }
  }

  return { requests, isLoading, error, busy, currentPage, totalPages, fetchRequests, goToPage, execute }
}
