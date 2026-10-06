import { useApi } from '@/composables/useApi'
import type { AdminPaymentDetail, AdminPaymentPage, AdminChargebackPage, PaymentsFilterState, PaymentTimelineEntry, PaymentTotals, PayoutOverride } from '@/features/payments/types/index'

function payoutOptions(override?: PayoutOverride): { method: 'POST'; body?: PayoutOverride } {
  return override ? { method: 'POST', body: override } : { method: 'POST' }
}

/** Filtres communs à la liste, aux totaux et à l'export : les trois montrent le même périmètre. */
function filterQuery(f: PaymentsFilterState): Record<string, string> {
  const query: Record<string, string> = {}
  if (f.status !== 'TOUS') query.status = f.status
  if (f.method !== 'TOUS') query.method = f.method
  if (f.currency && f.currency !== 'TOUTES') query.currency = f.currency
  if (f.dateFrom) query.dateFrom = f.dateFrom + 'T00:00:00'
  if (f.dateTo) query.dateTo = f.dateTo + 'T23:59:59'
  if (f.held) query.held = 'true'
  if (f.query?.trim()) query.q = f.query.trim()
  if (f.hideAbandoned) query.hideAbandoned = 'true'
  return query
}

export const paymentsService = {
  list(f: PaymentsFilterState, page: number, size: number): Promise<AdminPaymentPage> {
    return useApi()<AdminPaymentPage>('/admin/payments', { query: { ...filterQuery(f), page, size } })
  },
  summary(f: PaymentsFilterState): Promise<PaymentTotals[]> {
    return useApi()<PaymentTotals[]>('/admin/payments/summary', { query: filterQuery(f) })
  },
  exportCsv(f: PaymentsFilterState): Promise<Blob> {
    return useApi()<Blob>('/admin/payments/export', { query: filterQuery(f), responseType: 'blob' })
  },
  timeline(id: string): Promise<PaymentTimelineEntry[]> {
    return useApi()<PaymentTimelineEntry[]>(`/admin/payments/${id}/timeline`)
  },
  get(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}`) },
  /** Sans dérogation, aucun corps : le contrat historique reste intact pour un paiement normal. */
  forceRelease(id: string, override?: PayoutOverride): Promise<AdminPaymentDetail> {
    return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/force-release`, payoutOptions(override))
  },
  refund(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/refund`, { method: 'POST' }) },
  /** Relance un versement mobile money dont la dernière tentative est morte (paiement RELEASED). */
  retryMobileMoneyPayout(id: string, override?: PayoutOverride): Promise<AdminPaymentDetail> {
    return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/mobile-money/retry-payout`, payoutOptions(override))
  },
  /** Relance un remboursement mobile money dont la dernière tentative est morte (paiement REFUNDED ou CANCELLED). */
  retryMobileMoneyRefund(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/mobile-money/retry-refund`, { method: 'POST' }) },
  listChargebacks(page: number, size: number): Promise<AdminChargebackPage> { return useApi()<AdminChargebackPage>('/admin/chargebacks', { query: { page, size } }) },
}
