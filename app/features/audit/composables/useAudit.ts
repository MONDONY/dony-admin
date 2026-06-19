import { reactive, ref } from 'vue'
import { auditService } from '@/features/audit/services/auditService'
import type { AdminAuditEntry, AuditFilterState } from '@/features/audit/types/index'

function emptyFilters(): AuditFilterState {
  return { action: null, entityType: null, actorId: null, from: null, to: null }
}

export function useAudit() {
  const entries = ref<AdminAuditEntry[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<AuditFilterState>(emptyFilters())

  async function fetchAudit() {
    isLoading.value = true
    error.value = null
    try {
      const page = await auditService.list(filters, currentPage.value, pageSize.value)
      entries.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchAudit() }
  async function applyFilters() { currentPage.value = 0; await fetchAudit() }
  async function reset() {
    Object.assign(filters, emptyFilters())
    currentPage.value = 0
    await fetchAudit()
  }

  return { entries, isLoading, error, totalPages, currentPage, pageSize, filters, fetchAudit, goToPage, applyFilters, reset }
}
