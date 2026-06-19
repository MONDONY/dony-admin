import { ref } from 'vue'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { AdminDisputeListItem, DisputeStatusFilter } from '@/features/incidents/types/index'

export function useDisputes() {
  const disputes = ref<AdminDisputeListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const statusFilter = ref<DisputeStatusFilter>('OPEN')

  async function fetchDisputes() {
    isLoading.value = true; error.value = null
    try {
      const page = await incidentsService.listDisputes(statusFilter.value, currentPage.value, pageSize.value)
      disputes.value = page.content; totalPages.value = page.totalPages
    } catch (e) { error.value = (e as Error).message } finally { isLoading.value = false }
  }
  async function goToPage(p: number) { currentPage.value = p; await fetchDisputes() }
  async function setStatusFilter(s: DisputeStatusFilter) { statusFilter.value = s; currentPage.value = 0; await fetchDisputes() }

  return { disputes, isLoading, error, totalPages, currentPage, pageSize, statusFilter, fetchDisputes, goToPage, setStatusFilter }
}
