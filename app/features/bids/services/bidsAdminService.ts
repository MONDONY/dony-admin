import { useApi } from '@/composables/useApi'
import { isUuid } from '@/lib/safeInput'
import type { AdminBidCancelReason, AdminBidCancelResult, AdminDisputeReason, AdminOpenDisputeResult, DisputeParty } from '@/features/bids/lib/bidActions'
import type { AdminBidCounts, AdminBidDetail, AdminBidPage, AdminBidPhotos, AdminBidSuggest, AdminBidTimeline, AdminAnnouncementPage, AdminAnnouncementListItem, BidsFilterState } from '@/features/bids/types/index'

/** Filtres communs à la liste et aux nombres (hors vue, statut et alerte). */
function buildCommonQuery(f: BidsFilterState): Record<string, string | number> {
  const q: Record<string, string | number> = {}
  if (f.announcementId) q.announcementId = f.announcementId
  if (f.query.trim()) q.query = f.query.trim()
  if (f.scope && f.scope !== 'ALL') q.scope = f.scope
  if (f.paymentMethod) q.paymentMethod = f.paymentMethod
  if (f.content.trim()) q.content = f.content.trim()
  if (f.dateFrom) q.dateFrom = f.dateFrom + 'T00:00:00'
  if (f.dateTo) q.dateTo = f.dateTo + 'T23:59:59'
  return q
}

function buildQuery(f: BidsFilterState, page: number, size: number): Record<string, string | number> {
  const q: Record<string, string | number> = { page, size, ...buildCommonQuery(f) }
  if (f.status && f.status !== 'TOUS') q.status = f.status
  if (f.view && f.view !== 'ALL') q.view = f.view
  if (f.alert) q.alert = f.alert
  return q
}

export const bidsAdminService = {
  listBids(filters: BidsFilterState, page: number, size: number): Promise<AdminBidPage> {
    return useApi()<AdminBidPage>('/admin/bids', { query: buildQuery(filters, page, size) })
  },
  /** Nombres par vue : mêmes filtres que la liste, sans vue, statut ni alerte. Groupe d'alertes absent : zéros. */
  async counts(filters: BidsFilterState): Promise<AdminBidCounts> {
    const r = await useApi()<AdminBidCounts>('/admin/bids/counts', { query: buildCommonQuery(filters) })
    const a: Partial<AdminBidCounts['alerts']> = r.alerts ?? {}
    return { ...r, alerts: { disputeOpen: a.disputeOpen ?? 0, noShow: a.noShow ?? 0, paymentPending: a.paymentPending ?? 0, late: a.late ?? 0 } }
  },
  /** Suggestions de recherche ; le back omet les groupes vides (NON_NULL), normalisés en `[]`. */
  async suggest(q: string): Promise<AdminBidSuggest> {
    const r = await useApi()<Partial<AdminBidSuggest>>('/admin/bids/suggest', { query: { q: q.trim() } })
    return { senders: r.senders ?? [], travelers: r.travelers ?? [], recipients: r.recipients ?? [], trips: r.trips ?? [], parcels: r.parcels ?? [] }
  },
  /** Photos du colis par étape. L'identifiant est validé (UUID) avant de devenir un segment d'URL. */
  async photos(id: string): Promise<AdminBidPhotos> {
    if (!isUuid(id)) return Promise.reject(new Error('Identifiant de colis invalide'))
    const r = await useApi()<Partial<AdminBidPhotos>>(`/admin/bids/${id}/photos`)
    return { bidId: r.bidId ?? id, photos: r.photos ?? [] }
  },
  getBid(id: string): Promise<AdminBidDetail> {
    return useApi()<AdminBidDetail>(`/admin/bids/${encodeURIComponent(id)}`)
  },
  getTimeline(id: string): Promise<AdminBidTimeline> {
    return useApi()<AdminBidTimeline>(`/admin/bids/${encodeURIComponent(id)}/timeline`)
  },
  /** Annulation par un super-admin. L'identifiant est validé (UUID) avant de devenir un segment d'URL. */
  cancelBid(id: string, reason: AdminBidCancelReason, note: string): Promise<AdminBidCancelResult> {
    if (!isUuid(id)) return Promise.reject(new Error('Identifiant de colis invalide'))
    return useApi()<AdminBidCancelResult>(`/admin/bids/${id}/cancel`, { method: 'POST', body: { reason, note: note || null } })
  },
  /** Litige ouvert par un super-admin au nom de l'expéditeur ou du voyageur. */
  openDispute(id: string, openedOnBehalfOf: DisputeParty, reason: AdminDisputeReason, description: string): Promise<AdminOpenDisputeResult> {
    if (!isUuid(id)) return Promise.reject(new Error('Identifiant de colis invalide'))
    return useApi()<AdminOpenDisputeResult>(`/admin/bids/${id}/disputes`, { method: 'POST', body: { openedOnBehalfOf, reason, description } })
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
