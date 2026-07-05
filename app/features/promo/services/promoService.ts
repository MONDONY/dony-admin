import { useApi } from '@/composables/useApi'
import type { AdminPromoCode, PromoCodeInput, PromoStatus } from '@/features/promo/types/index'

/** Le back renvoie la liste complète (non paginée) ; filtres/pagination côté client. */
export const promoService = {
  list(): Promise<AdminPromoCode[]> {
    return useApi()<AdminPromoCode[]>('/admin/promo-codes')
  },
  create(input: PromoCodeInput): Promise<AdminPromoCode> {
    return useApi()<AdminPromoCode>('/admin/promo-codes', { method: 'POST', body: input })
  },
  update(id: string, input: PromoCodeInput): Promise<AdminPromoCode> {
    return useApi()<AdminPromoCode>(`/admin/promo-codes/${id}`, { method: 'PUT', body: input })
  },
  setStatus(id: string, status: PromoStatus): Promise<AdminPromoCode> {
    return useApi()<AdminPromoCode>(`/admin/promo-codes/${id}/status`, { method: 'PUT', body: { status } })
  },
  remove(id: string): Promise<void> {
    return useApi()(`/admin/promo-codes/${id}`, { method: 'DELETE' })
  },
}
