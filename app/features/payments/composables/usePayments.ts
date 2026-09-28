import { reactive, ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { AdminPaymentListItem, PaymentsFilterState, PaymentStatusFilter, PaymentMethodFilter, PaymentCurrencyFilter } from '@/features/payments/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

export function usePayments() {
  const payments = ref<AdminPaymentListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<PaymentsFilterState>({ status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null, held: false })
  /**
   * Un ancien back ignore `held=true` et renvoie TOUS les paiements, sans
   * `beneficiaryHeld` : les afficher sous le filtre « Versements retenus » ferait croire que
   * tout est bloqué. On vide alors la liste et on le dit.
   */
  const heldFilterUnsupported = ref(false)

  async function fetchPayments() {
    isLoading.value = true; error.value = null
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
  async function goToPage(p: number) { currentPage.value = p; await fetchPayments() }
  async function setStatusFilter(s: PaymentStatusFilter) { filters.status = s; currentPage.value = 0; await fetchPayments() }
  async function setMethodFilter(m: PaymentMethodFilter) { filters.method = m; currentPage.value = 0; await fetchPayments() }
  async function setCurrencyFilter(c: PaymentCurrencyFilter) { filters.currency = c; currentPage.value = 0; await fetchPayments() }
  async function setHeldFilter(h: boolean) { filters.held = h; currentPage.value = 0; await fetchPayments() }
  async function setDateRange(from: string | null, to: string | null) { filters.dateFrom = from; filters.dateTo = to; currentPage.value = 0; await fetchPayments() }

  return { payments, isLoading, error, totalPages, currentPage, pageSize, filters, fetchPayments, goToPage, setStatusFilter, setMethodFilter, setCurrencyFilter, setDateRange, setHeldFilter, heldFilterUnsupported }
}
