import { reactive, ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidListItem, BidsFilterState, BidStatusFilter } from '@/features/bids/types/index'

export function useAdminBids() {
  const bids = ref<AdminBidListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<BidsFilterState>({ status: 'TOUS', announcementId: null, query: '' })

  async function fetchBids() {
    isLoading.value = true; error.value = null
    try {
      const page = await bidsAdminService.listBids(filters, currentPage.value, pageSize.value)
      bids.value = page.content; totalPages.value = page.totalPages
    } catch (e) { error.value = (e as Error).message } finally { isLoading.value = false }
  }
  async function goToPage(p: number) { currentPage.value = p; await fetchBids() }
  async function setStatusFilter(s: BidStatusFilter) { filters.status = s; currentPage.value = 0; await fetchBids() }
  async function setSearch(q: string) { filters.query = q; currentPage.value = 0; await fetchBids() }

  return { bids, isLoading, error, totalPages, currentPage, pageSize, filters, fetchBids, goToPage, setStatusFilter, setSearch }
}
