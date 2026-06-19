import { useApi } from '@/composables/useApi'
import type { AdminDisputeDetail, AdminDisputePage, AdminCancellationPage, DisputeStatusFilter, DisputeResolution, NoShowFilter } from '@/features/incidents/types/index'

export const incidentsService = {
  listDisputes(status: DisputeStatusFilter, page: number, size: number): Promise<AdminDisputePage> {
    const query: Record<string, string | number> = { page, size }
    if (status !== 'TOUS') query.status = status
    return useApi()<AdminDisputePage>('/admin/disputes', { query })
  },
  getDispute(id: string): Promise<AdminDisputeDetail> {
    return useApi()<AdminDisputeDetail>(`/admin/disputes/${id}`)
  },
  resolveDispute(id: string, resolution: DisputeResolution, note: string): Promise<AdminDisputeDetail> {
    return useApi()<AdminDisputeDetail>(`/admin/disputes/${id}/resolve`, { method: 'POST', body: { resolution, note } })
  },
  payGuaranteeFund(id: string, amountCents: number, beneficiaryUserId: string, reason: string): Promise<AdminDisputeDetail> {
    return useApi()<AdminDisputeDetail>(`/admin/disputes/${id}/guarantee-fund`, { method: 'POST', body: { amountCents, beneficiaryUserId, reason } })
  },
  listCancellations(noShow: NoShowFilter, page: number, size: number): Promise<AdminCancellationPage> {
    const query: Record<string, string | number> = { page, size }
    if (noShow !== 'ALL') query.noShowStatus = noShow
    return useApi()<AdminCancellationPage>('/admin/cancellations', { query })
  },
  confirmNoShow(bidId: string): Promise<unknown> {
    return useApi()(`/cancellations/bids/${bidId}/confirm-noshow`, { method: 'POST' })
  },
}
