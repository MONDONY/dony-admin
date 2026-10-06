import { reactive, ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { AdminPaymentListItem, PaymentsFilterState, PaymentStatusFilter, PaymentMethodFilter, PaymentCurrencyFilter, PaymentTotals } from '@/features/payments/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { downloadBlob } from '@/lib/downloadBlob'

export function usePayments() {
  const payments = ref<AdminPaymentListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  // Les checkouts abandonnés (en attente depuis plus de 24 h) sont masqués par défaut : ils
  // n'ont jamais déplacé d'argent et noyaient la liste.
  const filters = reactive<PaymentsFilterState>({ status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null, held: false, query: '', hideAbandoned: true })
  /** Totaux par devise du périmètre filtré ; null tant qu'ils ne sont pas chargés ou si le back ne les sert pas. */
  const totals = ref<PaymentTotals[] | null>(null)
  const exporting = ref(false)
  /**
   * Un ancien back ignore `held=true` et renvoie TOUS les paiements, sans
   * `beneficiaryHeld` : les afficher sous le filtre « Versements retenus » ferait croire que
   * tout est bloqué. On vide alors la liste et on le dit.
   */
  const heldFilterUnsupported = ref(false)

  async function fetchTotals() {
    try { totals.value = (await paymentsService.summary(filters)) ?? null } catch { totals.value = null }
  }

  /** Les totaux ne dépendent que des filtres : changer de page ne les recharge pas. */
  async function fetchPayments(withTotals = true) {
    isLoading.value = true; error.value = null
    if (withTotals) void fetchTotals()
    try {
      const page = await paymentsService.list(filters, currentPage.value, pageSize.value)
      // Le nouveau back envoie `beneficiaryHeld` sur CHAQUE paiement (booléen, même à false) :
      // une page où aucun n'en porte vient d'un back qui ignore le filtre.
      heldFilterUnsupported.value = Boolean(filters.held) && page.content.length > 0
        && page.content.every((p) => p.beneficiaryHeld === undefined)
      payments.value = heldFilterUnsupported.value ? [] : page.content
      totalPages.value = heldFilterUnsupported.value ? 0 : page.totalPages
    } catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger les paiements') } finally { isLoading.value = false }
  }
  async function goToPage(p: number) { currentPage.value = p; await fetchPayments(false) }
  async function setStatusFilter(s: PaymentStatusFilter) { filters.status = s; currentPage.value = 0; await fetchPayments() }
  async function setMethodFilter(m: PaymentMethodFilter) { filters.method = m; currentPage.value = 0; await fetchPayments() }
  async function setCurrencyFilter(c: PaymentCurrencyFilter) { filters.currency = c; currentPage.value = 0; await fetchPayments() }
  async function setHeldFilter(h: boolean) { filters.held = h; currentPage.value = 0; await fetchPayments() }
  async function setDateRange(from: string | null, to: string | null) { filters.dateFrom = from; filters.dateTo = to; currentPage.value = 0; await fetchPayments() }
  async function setQuery(q: string) { filters.query = q; currentPage.value = 0; await fetchPayments() }
  async function setHideAbandoned(h: boolean) { filters.hideAbandoned = h; currentPage.value = 0; await fetchPayments() }

  /** Télécharge la liste filtrée en CSV (droit EXPORT_RUN côté back). */
  async function exportCsv() {
    exporting.value = true; error.value = null
    try {
      const blob = await paymentsService.exportCsv(filters)
      downloadBlob(blob, `paiements_${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) { error.value = extractProblemMessage(e, 'Impossible d’exporter les paiements') } finally { exporting.value = false }
  }

  return { payments, isLoading, error, totalPages, currentPage, pageSize, filters, totals, exporting, fetchPayments, goToPage, setStatusFilter, setMethodFilter, setCurrencyFilter, setDateRange, setHeldFilter, setQuery, setHideAbandoned, exportCsv, heldFilterUnsupported }
}
