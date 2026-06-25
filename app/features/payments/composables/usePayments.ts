import { reactive, ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import type { AdminPaymentListItem, PaymentsFilterState, PaymentStatusFilter, PaymentMethodFilter } from '@/features/payments/types/index'

export function usePayments() {
  const payments = ref<AdminPaymentListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<PaymentsFilterState>({ status: 'TOUS', method: 'TOUS', dateFrom: null, dateTo: null })

  async function fetchPayments() {
    isLoading.value = true; error.value = null
    try {
      const page = await paymentsService.list(filters, currentPage.value, pageSize.value)
      payments.value = page.content; totalPages.value = page.totalPages
    } catch (e) { error.value = (e as Error).message } finally { isLoading.value = false }
  }
  async function goToPage(p: number) { currentPage.value = p; await fetchPayments() }
  async function setStatusFilter(s: PaymentStatusFilter) { filters.status = s; currentPage.value = 0; await fetchPayments() }
  async function setMethodFilter(m: PaymentMethodFilter) { filters.method = m; currentPage.value = 0; await fetchPayments() }
  async function setDateRange(from: string | null, to: string | null) { filters.dateFrom = from; filters.dateTo = to; currentPage.value = 0; await fetchPayments() }

  return { payments, isLoading, error, totalPages, currentPage, pageSize, filters, fetchPayments, goToPage, setStatusFilter, setMethodFilter, setDateRange }
}
