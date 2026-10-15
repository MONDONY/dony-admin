import { useApi } from '@/composables/useApi'
import type { AdminTopupCode, TopupCodeInput, TopupCodeRedemption } from '@/features/topup-codes/types/index'

/** Le back renvoie des listes complètes (non paginées) ; filtres/pagination côté client. */
export const topupCodesService = {
  list(): Promise<AdminTopupCode[]> {
    return useApi()<AdminTopupCode[]>('/admin/topup-codes')
  },
  create(input: TopupCodeInput): Promise<AdminTopupCode> {
    return useApi()<AdminTopupCode>('/admin/topup-codes', { method: 'POST', body: input })
  },
  redemptions(id: string): Promise<TopupCodeRedemption[]> {
    return useApi()<TopupCodeRedemption[]>(`/admin/topup-codes/${id}/redemptions`)
  },
  revoke(id: string): Promise<AdminTopupCode> {
    return useApi()<AdminTopupCode>(`/admin/topup-codes/${id}/revoke`, { method: 'POST' })
  },
  async generateCode(): Promise<string> {
    const res = await useApi()<{ code: string }>('/admin/topup-codes/generate-code', { method: 'POST' })
    return res.code
  },
}
