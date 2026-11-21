import { useApi } from '@/composables/useApi'
import type { AdminPromoCode, PromoCodeInput, PromoOriginFilter, PromoStatus } from '@/features/promo/types/index'

/** Le back renvoie la liste complète (non paginée) ; filtres/pagination côté client. */
export const promoService = {
  /** `origin` est filtré par le back ; ALL (ou absent) n'envoie pas le paramètre. */
  list(origin: PromoOriginFilter = 'ALL'): Promise<AdminPromoCode[]> {
    if (origin === 'ALL') return useApi()<AdminPromoCode[]>('/admin/promo-codes')
    return useApi()<AdminPromoCode[]>('/admin/promo-codes', { query: { origin } })
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
    return useApi()<void>(`/admin/promo-codes/${id}`, { method: 'DELETE' })
  },
}
