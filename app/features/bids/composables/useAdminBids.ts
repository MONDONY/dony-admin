import { reactive, ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidListItem, BidAlertCode, BidSearchScope, BidsFilterState, BidStatusFilter, BidView } from '@/features/bids/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

export function useAdminBids() {
  const bids = ref<AdminBidListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<BidsFilterState>({ status: 'TOUS', announcementId: null, query: '', scope: 'ALL', view: 'ALL', paymentMethod: null, content: '', alert: null, dateFrom: null, dateTo: null })

  let seq = 0

  async function fetchBids() {
    const my = ++seq
    isLoading.value = true; error.value = null
    try {
      const page = await bidsAdminService.listBids(filters, currentPage.value, pageSize.value)
      if (my !== seq) return
      bids.value = page.content; totalPages.value = page.totalPages
    } catch (e) {
      if (my !== seq) return
      error.value = extractProblemMessage(e, 'Impossible de charger les colis')
    } finally { if (my === seq) isLoading.value = false }
  }
  async function goToPage(p: number) { currentPage.value = p; await fetchBids() }
  async function setStatusFilter(s: BidStatusFilter) { filters.status = s; currentPage.value = 0; await fetchBids() }
  async function setSearch(q: string) { filters.query = q; currentPage.value = 0; await fetchBids() }
  /** Colis d'un même trajet (« autres colis sur ce trajet ») ; null pour tous. */
  async function setAnnouncementFilter(id: string | null) { filters.announcementId = id; currentPage.value = 0; await fetchBids() }
  async function setDateRange(from: string | null, to: string | null) { filters.dateFrom = from; filters.dateTo = to; currentPage.value = 0; await fetchBids() }
  async function setView(v: BidView) {
    filters.view = v
    if (v === 'TODO') { filters.status = 'TOUS'; filters.alert = null }
    currentPage.value = 0; await fetchBids()
  }
  /**
   * Recherche validée (texte ou suggestion choisie). Retrouver un colis passe d'abord : depuis
   * « À traiter », une recherche non vide bascule sur « Tous ». La vider ne rebascule pas.
   */
  async function search(q: string, scope?: BidSearchScope) {
    if (scope) filters.scope = scope
    filters.query = q
    if (q.trim() && filters.view === 'TODO') filters.view = 'ALL'
    currentPage.value = 0; await fetchBids()
  }
  /** Portée : sans texte, elle ne change pas la liste (pas de rechargement). */
  async function setScope(s: BidSearchScope) {
    filters.scope = s
    if (!filters.query.trim()) return
    if (filters.view === 'TODO') filters.view = 'ALL'
    currentPage.value = 0; await fetchBids()
  }
  async function setPaymentMethod(m: string | null) { filters.paymentMethod = m; currentPage.value = 0; await fetchBids() }
  async function setContent(c: string) { filters.content = c; currentPage.value = 0; await fetchBids() }
  async function setAlert(a: BidAlertCode | null) { filters.alert = a; currentPage.value = 0; await fetchBids() }
  /** Remet tous les filtres aux défauts, sauf le trajet (annonce) ciblé. */
  async function resetFilters() {
    Object.assign(filters, { status: 'TOUS', query: '', scope: 'ALL', view: 'ALL', paymentMethod: null, content: '', alert: null, dateFrom: null, dateTo: null })
    currentPage.value = 0; await fetchBids()
  }

  return { bids, isLoading, error, totalPages, currentPage, pageSize, filters, fetchBids, goToPage, setStatusFilter, setSearch, setDateRange, setAnnouncementFilter, setView, search, setScope, setPaymentMethod, setContent, setAlert, resetFilters }
}
