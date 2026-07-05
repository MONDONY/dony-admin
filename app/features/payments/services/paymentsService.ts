import { useApi } from '@/composables/useApi'
import type { AdminPaymentDetail, AdminPaymentPage, AdminChargebackPage, PaymentsFilterState } from '@/features/payments/types/index'

export const paymentsService = {
  list(f: PaymentsFilterState, page: number, size: number): Promise<AdminPaymentPage> {
    const query: Record<string, string | number> = { page, size }
    if (f.status !== 'TOUS') query.status = f.status
    if (f.method !== 'TOUS') query.method = f.method
    if (f.dateFrom) query.dateFrom = f.dateFrom + 'T00:00:00'
    if (f.dateTo) query.dateTo = f.dateTo + 'T23:59:59'
    return useApi()<AdminPaymentPage>('/admin/payments', { query })
  },
  get(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}`) },
  forceRelease(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/force-release`, { method: 'POST' }) },
  refund(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/refund`, { method: 'POST' }) },
  listChargebacks(page: number, size: number): Promise<AdminChargebackPage> { return useApi()<AdminChargebackPage>('/admin/chargebacks', { query: { page, size } }) },
}
