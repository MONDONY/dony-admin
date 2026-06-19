import { useApi } from '@/composables/useApi'
import type { AdminPromoCode, AdminPromoCodePage, PromoCodeInput, PromoFilterState } from '@/features/promo/types/index'

function buildQuery(f: PromoFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.active !== null) q.active = f.active
  return q
}

export const promoService = {
  list(filters: PromoFilterState, page: number, size: number): Promise<AdminPromoCodePage> {
    return useApi()<AdminPromoCodePage>('/admin/promo-codes', { query: buildQuery(filters, page, size) })
  },
  create(input: PromoCodeInput): Promise<AdminPromoCode> {
    return useApi()<AdminPromoCode>('/admin/promo-codes', { method: 'POST', body: input })
  },
  update(id: string, input: PromoCodeInput): Promise<AdminPromoCode> {
    return useApi()<AdminPromoCode>(`/admin/promo-codes/${id}`, { method: 'PUT', body: input })
  },
  remove(id: string): Promise<void> {
    return useApi()(`/admin/promo-codes/${id}`, { method: 'DELETE' })
  },
}
