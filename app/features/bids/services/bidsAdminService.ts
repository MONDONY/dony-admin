import { useApi } from '@/composables/useApi'
import type { AdminBidDetail, AdminBidPage, AdminBidTimeline, AdminAnnouncementPage, AdminAnnouncementListItem, BidsFilterState } from '@/features/bids/types/index'

function buildQuery(f: BidsFilterState, page: number, size: number): Record<string, string | number> {
  const q: Record<string, string | number> = { page, size }
  if (f.status && f.status !== 'TOUS') q.status = f.status
  if (f.announcementId) q.announcementId = f.announcementId
  if (f.query.trim()) q.query = f.query.trim()
  if (f.dateFrom) q.dateFrom = f.dateFrom + 'T00:00:00'
  if (f.dateTo) q.dateTo = f.dateTo + 'T23:59:59'
  return q
}

export const bidsAdminService = {
  listBids(filters: BidsFilterState, page: number, size: number): Promise<AdminBidPage> {
    return useApi()<AdminBidPage>('/admin/bids', { query: buildQuery(filters, page, size) })
  },
  getBid(id: string): Promise<AdminBidDetail> {
    return useApi()<AdminBidDetail>(`/admin/bids/${encodeURIComponent(id)}`)
  },
  getTimeline(id: string): Promise<AdminBidTimeline> {
    return useApi()<AdminBidTimeline>(`/admin/bids/${encodeURIComponent(id)}/timeline`)
  },
  /** `id` : l'annonce d'un colis seule (un ancien back l'ignore et renvoie la page entière). */
  listAnnouncements(page: number, size: number, id?: string | null): Promise<AdminAnnouncementPage> {
    const query: Record<string, string | number> = { page, size }
    if (id) query.id = id
    return useApi()<AdminAnnouncementPage>('/admin/announcements', { query })
  },
  removeAnnouncement(id: string, publicReason: string, internalNote: string): Promise<AdminAnnouncementListItem> {
    return useApi()<AdminAnnouncementListItem>(`/admin/announcements/${id}/remove`, { method: 'POST', body: { publicReason, internalNote } })
  },
  restoreAnnouncement(id: string): Promise<AdminAnnouncementListItem> {
    return useApi()<AdminAnnouncementListItem>(`/admin/announcements/${id}/restore`, { method: 'POST' })
  },
}
