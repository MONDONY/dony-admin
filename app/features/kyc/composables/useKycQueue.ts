import { reactive, ref } from 'vue'
import { kycService } from '@/features/kyc/services/kycService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import type { AdminKycQueueItem, KycProvider, KycQueueFilters, KycQueueStatus } from '@/features/kyc/types/index'

const PAGE_SIZE = 20

/**
 * File paginée côté serveur des vérifications d'identité. `unavailable` : ancien back sans
 * l'endpoint (règle des PR jumelles), mention discrète au lieu d'une erreur rouge.
 */
export function useKycQueue(initialStatus: KycQueueStatus = 'IN_REVIEW') {
  const items = ref<AdminKycQueueItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  const currentPage = ref(0)
  const totalPages = ref(0)
  const totalElements = ref(0)
  const filters = reactive<KycQueueFilters>({ status: initialStatus, provider: null, query: '', from: null, to: null })

  /** La page courante ne change qu'une fois la nouvelle page reçue : un échec laisse l'ancienne affichée. */
  async function load(page = currentPage.value) {
    isLoading.value = true
    error.value = null
    try {
      const res = await kycService.listVerifications({ ...filters }, page, PAGE_SIZE)
      items.value = res.content ?? []
      totalPages.value = res.totalPages ?? 0
      totalElements.value = res.totalElements ?? items.value.length
      currentPage.value = res.number ?? page
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible de charger la file des vérifications')
    } finally {
      isLoading.value = false
    }
  }

  const goToPage = (page: number) => load(page)
  async function setStatus(s: KycQueueStatus) { filters.status = s; await load(0) }
  async function setProvider(p: KycProvider | null) { filters.provider = p; await load(0) }
  async function setDateRange(from: string | null, to: string | null) { filters.from = from; filters.to = to; await load(0) }
  async function setQuery(q: string) {
    const next = q.trim()
    if (next === filters.query) return
    filters.query = next
    await load(0)
  }

  return {
    items, isLoading, error, unavailable, currentPage, totalPages, totalElements, filters,
    load, goToPage, setStatus, setProvider, setDateRange, setQuery,
  }
}
