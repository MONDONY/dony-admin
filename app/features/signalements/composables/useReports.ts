import { reactive, ref } from 'vue'
import { reportsService } from '@/features/signalements/services/reportsService'
import type { AdminReport, ReportAction, ReportsFilterState, ReportStatusFilter, ReportTargetType } from '@/features/signalements/types/index'

export function useReports() {
  const reports = ref<AdminReport[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<ReportsFilterState>({ status: 'OPEN', targetType: null })

  async function fetchReports() {
    isLoading.value = true
    error.value = null
    try {
      const page = await reportsService.list(filters, currentPage.value, pageSize.value)
      reports.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchReports() }
  async function setStatusFilter(s: ReportStatusFilter) { filters.status = s; currentPage.value = 0; await fetchReports() }
  async function setTargetTypeFilter(t: ReportTargetType | null) { filters.targetType = t; currentPage.value = 0; await fetchReports() }
  async function resolve(id: string, action: ReportAction, note: string) {
    await reportsService.resolve(id, action, note)
    await fetchReports()
  }

  return { reports, isLoading, error, totalPages, currentPage, pageSize, filters, fetchReports, goToPage, setStatusFilter, setTargetTypeFilter, resolve }
}
