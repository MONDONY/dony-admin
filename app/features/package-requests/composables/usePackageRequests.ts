import { reactive, ref } from 'vue'
import { packageRequestsService } from '@/features/package-requests/services/packageRequestsService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import type {
  AdminPackageRequestDetail, AdminPackageRequestListItem, PackageRequestFilters, PackageRequestStatusFilter,
} from '@/features/package-requests/types/index'

const PAGE_SIZE = 20

/**
 * Liste paginée côté serveur des demandes d'envoi (onglet « Demandes » de /colis).
 * `unavailable` : ancien back sans l'endpoint (règle des PR jumelles), mention discrète
 * au lieu d'une erreur rouge.
 */
export function usePackageRequests() {
  const requests = ref<AdminPackageRequestListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  const currentPage = ref(0)
  const totalPages = ref(0)
  const totalElements = ref(0)
  const filters = reactive<PackageRequestFilters>({ status: 'ALL', query: '', reportedOnly: false, from: null, to: null })

  /** La page courante ne change qu'une fois la nouvelle page reçue : un échec laisse l'ancienne affichée. */
  async function load(page = currentPage.value) {
    isLoading.value = true
    error.value = null
    try {
      const res = await packageRequestsService.list({ ...filters }, page, PAGE_SIZE)
      requests.value = res.content
      totalPages.value = res.totalPages
      totalElements.value = res.totalElements
      currentPage.value = page
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible de charger les demandes d’envoi')
    } finally {
      isLoading.value = false
    }
  }

  const goToPage = (page: number) => load(page)
  async function setStatus(s: PackageRequestStatusFilter) { filters.status = s; await load(0) }
  async function setReportedOnly(v: boolean) { filters.reportedOnly = v; await load(0) }
  async function setDateRange(from: string | null, to: string | null) { filters.from = from; filters.to = to; await load(0) }
  async function setQuery(q: string) {
    const next = q.trim()
    if (next === filters.query) return
    filters.query = next
    await load(0)
  }

  /** Répercute sur la ligne le détail renvoyé par un retrait ou une restauration. */
  function replace(updated: AdminPackageRequestDetail | AdminPackageRequestListItem) {
    const idx = requests.value.findIndex((r) => r.id === updated.id)
    if (idx === -1) return
    const row = { ...requests.value[idx]! }
    for (const key of Object.keys(row) as (keyof AdminPackageRequestListItem)[]) {
      if (key in updated) (row as Record<string, unknown>)[key] = updated[key]
    }
    requests.value[idx] = row
  }

  return {
    requests, isLoading, error, unavailable, currentPage, totalPages, totalElements, filters,
    load, goToPage, setStatus, setReportedOnly, setDateRange, setQuery, replace,
  }
}
