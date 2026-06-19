import { ref } from 'vue'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { AdminCancellation, NoShowFilter } from '@/features/incidents/types/index'

export function useNoShows() {
  const cancellations = ref<AdminCancellation[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const filter = ref<NoShowFilter>('PENDING_CONFIRMATION')

  async function fetchCancellations() {
    isLoading.value = true; error.value = null
    try { cancellations.value = (await incidentsService.listCancellations(filter.value, 0, 20)).content }
    catch (e) { error.value = (e as Error).message } finally { isLoading.value = false }
  }
  async function setFilter(f: NoShowFilter) { filter.value = f; await fetchCancellations() }
  async function confirm(bidId: string) { await incidentsService.confirmNoShow(bidId); await fetchCancellations() }

  return { cancellations, isLoading, error, filter, fetchCancellations, setFilter, confirm }
}
