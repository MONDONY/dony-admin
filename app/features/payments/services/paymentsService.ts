import { useApi } from '@/composables/useApi'
import type { AdminPaymentDetail, AdminPaymentPage, AdminChargebackPage, ChargebackCounts, ChargebackListParams, PaymentSuggest, PaymentViewCounts, PaymentsFilterState, PaymentTimelineEntry, PaymentTotals, PayoutOverride, StripeResyncResult } from '@/features/payments/types/index'

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

/** Filtres de la liste, du résumé et de l'export. Chaque nouveau paramètre est omis à son défaut. */
function listQuery(f: PaymentsFilterState): Record<string, string | number> {
  const query: Record<string, string | number> = { ...filterQuery(f), ...scopeQuery(f) }
  if (f.view && f.view !== 'ALL') query.view = f.view
  if (f.alert) query.alert = f.alert
  return query
}

/** Périmètre commun à la liste ET aux nombres : ni vue, ni alerte, ni statut. */
function scopeQuery(f: PaymentsFilterState): Record<string, string | number> {
  const query: Record<string, string | number> = {}
  if (f.partyId) query.partyId = f.partyId
  if (f.announcementId) query.announcementId = f.announcementId
  if (f.bidId) query.bidId = f.bidId
  if (f.amountMin != null) query.amountMin = f.amountMin
  if (f.amountMax != null) query.amountMax = f.amountMax
  return query
}

/** `(page, size)` : signature historique, gardée jusqu'à la migration des appelants (Task 10) ; sinon un objet de paramètres. */
function listChargebacks(a: number | ChargebackListParams, b?: number): Promise<AdminChargebackPage> {
  if (typeof a === 'number') return useApi()<AdminChargebackPage>('/admin/chargebacks', { query: { page: a, size: b } })
  const query: Record<string, string | number> = {}
  if (a.view && a.view !== 'ALL') query.view = a.view
  if (a.q?.trim()) query.q = a.q.trim()
  query.page = a.page ?? 0
  query.size = a.size ?? 20
  return useApi()<AdminChargebackPage>('/admin/chargebacks', { query })
}

export const paymentsService = {
  list(f: PaymentsFilterState, page: number, size: number): Promise<AdminPaymentPage> {
    return useApi()<AdminPaymentPage>('/admin/payments', { query: { ...listQuery(f), page, size } })
  },
  summary(f: PaymentsFilterState): Promise<PaymentTotals[]> {
    return useApi()<PaymentTotals[]>('/admin/payments/summary', { query: listQuery(f) })
  },
  exportCsv(f: PaymentsFilterState): Promise<Blob> {
    return useApi()<Blob>('/admin/payments/export', { query: listQuery(f), responseType: 'blob' })
  },
  timeline(id: string): Promise<PaymentTimelineEntry[]> {
    return useApi()<PaymentTimelineEntry[]>(`/admin/payments/${id}/timeline`)
  },
  get(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}`) },
  /** Sans dérogation, aucun corps : le contrat historique reste intact pour un paiement normal. */
  forceRelease(id: string, override?: PayoutOverride): Promise<AdminPaymentDetail> {
    return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/force-release`, payoutOptions(override))
  },
  /** Réaligne un paiement carte sur Stripe (super-admin, back #487). Corps vide. */
  resyncStripe(id: string): Promise<StripeResyncResult> {
    return useApi()<StripeResyncResult>(`/admin/payments/${id}/resync-stripe`, { method: 'POST' })
  },
  refund(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/refund`, { method: 'POST' }) },
  /** Relance un versement mobile money dont la dernière tentative est morte (paiement RELEASED). */
  retryMobileMoneyPayout(id: string, override?: PayoutOverride): Promise<AdminPaymentDetail> {
    return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/mobile-money/retry-payout`, payoutOptions(override))
  },
  /** Relance un remboursement mobile money dont la dernière tentative est morte (paiement REFUNDED ou CANCELLED). */
  retryMobileMoneyRefund(id: string): Promise<AdminPaymentDetail> { return useApi()<AdminPaymentDetail>(`/admin/payments/${id}/mobile-money/retry-refund`, { method: 'POST' }) },
  /**
   * Nombres par vue : mêmes filtres que la liste, SANS vue, alerte ni statut. `alerts` est non
   * exclusif (une alerte peut en recouper une autre) ; groupe absent (ancien back) = zéros.
   */
  async counts(f: PaymentsFilterState): Promise<PaymentViewCounts> {
    const rest = filterQuery(f)
    delete rest.status
    const r = await useApi()<PaymentViewCounts>('/admin/payments/counts', { query: { ...rest, ...scopeQuery(f) } })
    const a: Partial<PaymentViewCounts['alerts']> = r.alerts ?? {}
    return { ...r, alerts: { held: a.held ?? 0, chargebackOpen: a.chargebackOpen ?? 0, mmFailed: a.mmFailed ?? 0, escrowJ48: a.escrowJ48 ?? 0 } }
  },
  /** Propositions de recherche ; le back omet les groupes vides (NON_NULL), normalisés en `[]`. */
  async suggest(q: string): Promise<PaymentSuggest> {
    const r = await useApi()<Partial<PaymentSuggest>>('/admin/payments/suggest', { query: { q: q.trim() } })
    return { ...r, senders: r.senders ?? [], travelers: r.travelers ?? [], trips: r.trips ?? [], parcels: r.parcels ?? [] }
  },
  listChargebacks,
  /** Nombres des litiges bancaires par statut ; ils suivent la recherche, jamais la vue. */
  chargebackCounts(q?: string): Promise<ChargebackCounts> {
    return useApi()<ChargebackCounts>('/admin/chargebacks/counts', { query: q?.trim() ? { q: q.trim() } : {} })
  },
}
