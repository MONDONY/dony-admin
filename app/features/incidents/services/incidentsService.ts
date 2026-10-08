import { useApi } from '@/composables/useApi'
import type {
  AdminDisputeDetail, AdminDisputePage, DisputeStatusFilter, DisputeResolution, AdminDisputeSplitOptions,
  AdminNoShow, AdminNoShowPage, AdminNoShowPageRaw, AdminNoShowRaw, NoShowFilters, NoShowParty, NoShowStatus,
} from '@/features/incidents/types/index'

/** Rôles déduits du motif quand l'ancien back ne décrit pas les parties. */
const LEGACY_ROLES: Record<string, [NoShowParty['role'], NoShowParty['role']]> = {
  SENDER_NO_SHOW: ['TRAVELER', 'SENDER'],
  RECIPIENT_NO_SHOW: ['TRAVELER', 'RECIPIENT'],
  TRAVELER_DELIVERY_NO_SHOW: ['SENDER', 'TRAVELER'],
}

/**
 * Ligne lisible par l'écran, quel que soit le back. L'ancien (sans `scope`) ne renvoie que
 * l'UUID de l'auteur et `noShowStatus` ; son unique action admin confirme une absence de
 * l'expéditeur encore en attente, et il ne sait pas rejeter.
 */
export function normalizeNoShow(raw: AdminNoShowRaw): AdminNoShow {
  const legacy = raw.scope == null
  const status: NoShowStatus = raw.status ?? raw.noShowStatus ?? 'PENDING_CONFIRMATION'
  let declarant = raw.declarant ?? null
  let accused = raw.accused ?? null
  const roles = LEGACY_ROLES[raw.reason]
  if (legacy && roles) {
    declarant = declarant ?? { role: roles[0], userId: raw.cancelledBy ?? null }
    accused = accused ?? { role: roles[1] }
  }
  return {
    id: raw.id, bidId: raw.bidId, legacy, scope: raw.scope ?? null, reason: raw.reason, status,
    contestationDeadline: raw.contestationDeadline ?? null, remainingMinutes: raw.remainingMinutes ?? null,
    createdAt: raw.createdAt, declarant, accused, trip: raw.trip ?? null, handoverAt: raw.handoverAt ?? null,
    amount: raw.amount ?? null, currency: raw.currency ?? null, paymentMethod: raw.paymentMethod ?? null,
    paymentStatus: raw.paymentStatus ?? null, bidStatus: raw.bidStatus ?? null, dispute: raw.dispute ?? null,
    canConfirm: legacy ? status === 'PENDING_CONFIRMATION' && raw.reason === 'SENDER_NO_SHOW' : raw.canConfirm === true,
    canReject: legacy ? false : raw.canReject === true,
    commissionStatus: raw.commissionStatus ?? null, adminDecision: raw.adminDecision ?? null,
    decidedAt: raw.decidedAt ?? null, decisionReason: raw.decisionReason ?? null,
  }
}

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
  /** Résolution avec partage chiffré du séquestre (FLUTTER-E2), montants en unité principale. */
  resolveDisputeWithSplit(id: string, senderRefundAmount: number, travelerPayoutAmount: number, note: string): Promise<AdminDisputeDetail> {
    return useApi()<AdminDisputeDetail>(`/admin/disputes/${id}/resolve`, {
      method: 'POST', body: { resolution: 'SPLIT', note, senderRefundAmount, travelerPayoutAmount },
    })
  },
  getSplitOptions(id: string): Promise<AdminDisputeSplitOptions> {
    return useApi()<AdminDisputeSplitOptions>(`/admin/disputes/${id}/split-options`)
  },
  /** Reprend un partage interrompu entre le remboursement et le transfert. */
  retrySplit(id: string): Promise<AdminDisputeDetail> {
    return useApi()<AdminDisputeDetail>(`/admin/disputes/${id}/split/retry`, { method: 'POST' })
  },
  payGuaranteeFund(id: string, amountCents: number, beneficiaryUserId: string, reason: string, currency?: string | null): Promise<AdminDisputeDetail> {
    // La devise n'est envoyée que lorsqu'elle est connue : le backend la vérifie contre celle
    // du colis et l'exige quand le litige n'a pas de bid.
    const body: Record<string, unknown> = { amountCents, beneficiaryUserId, reason }
    if (currency) body.currency = currency
    return useApi()<AdminDisputeDetail>(`/admin/disputes/${id}/guarantee-fund`, { method: 'POST', body })
  },
  /** `noShowStatus` double `status` pour l'ancien back, qui ignore `status` et `scope`. */
  async listNoShows(filters: NoShowFilters, page: number, size: number): Promise<AdminNoShowPage> {
    const query: Record<string, string | number> = { page, size }
    if (filters.status !== 'ALL') { query.status = filters.status; query.noShowStatus = filters.status }
    if (filters.scope !== 'ALL') query.scope = filters.scope
    const res = await useApi()<AdminNoShowPageRaw>('/admin/cancellations', { query })
    return { ...res, content: (res.content ?? []).map(normalizeNoShow) }
  },
  async confirmNoShow(id: string, reason: string): Promise<AdminNoShow> {
    return normalizeNoShow(await useApi()<AdminNoShowRaw>(`/admin/cancellations/${id}/confirm`, { method: 'POST', body: { reason } }))
  },
  async rejectNoShow(id: string, reason: string): Promise<AdminNoShow> {
    return normalizeNoShow(await useApi()<AdminNoShowRaw>(`/admin/cancellations/${id}/reject`, { method: 'POST', body: { reason } }))
  },
  /** Ancien back : confirmation par bid, seulement pour une absence de l'expéditeur au départ. */
  confirmLegacyNoShow(bidId: string): Promise<unknown> {
    return useApi()<unknown>(`/cancellations/bids/${bidId}/confirm-noshow`, { method: 'POST' })
  },
}
