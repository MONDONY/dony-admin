import { ref } from 'vue'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { AdminCancellation, NoShowFilter } from '@/features/incidents/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

export function useNoShows() {
  const cancellations = ref<AdminCancellation[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const filter = ref<NoShowFilter>('PENDING_CONFIRMATION')
  const currentPage = ref(0)
  const totalPages = ref(0)
  const pageSize = 20

  /** La page courante ne change qu'une fois la nouvelle page reçue : un échec laisse l'ancienne affichée. */
  async function fetchCancellations(page = currentPage.value) {
    isLoading.value = true; error.value = null
    try {
      const res = await incidentsService.listCancellations(filter.value, page, pageSize)
      cancellations.value = res.content
      totalPages.value = res.totalPages
      currentPage.value = page
    }
    catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger les annulations') } finally { isLoading.value = false }
  }
  const goToPage = (page: number) => fetchCancellations(page)
  async function setFilter(f: NoShowFilter) { filter.value = f; await fetchCancellations(0) }
  async function confirm(bidId: string) { await incidentsService.confirmNoShow(bidId); await fetchCancellations() }

  return { cancellations, isLoading, error, filter, currentPage, totalPages, fetchCancellations, goToPage, setFilter, confirm }
}
