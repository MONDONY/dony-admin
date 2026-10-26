import { useApi } from '@/composables/useApi'
import type { AdminAlert, AdminAlertPage, AlertBatchResult, AlertContext, AlertsFilterState, AlertViolations } from '@/features/alerts/types/index'

function buildQuery(f: AlertsFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.type) q.type = f.type
  if (f.severity) q.severity = f.severity
  if (f.resolved === 'OPEN') { q.resolved = false; q.snoozed = false }
  else if (f.resolved === 'SNOOZED') { q.resolved = false; q.snoozed = true }
  else if (f.resolved === 'RESOLVED') q.resolved = true
  return q
}

export const alertsService = {
  list(filters: AlertsFilterState, page: number, size: number): Promise<AdminAlertPage> {
    return useApi()<AdminAlertPage>('/admin/alerts', { query: buildQuery(filters, page, size) })
  },
  /** Une alerte par identifiant (ALERT_VIEW) ; 404 sans `code` sur un back qui ne l'a pas encore. */
  get(id: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${id}`)
  },
  violations(id: string): Promise<AlertViolations> {
    return useApi()<AlertViolations>(`/admin/alerts/${id}/violations`)
  },
  resolve(id: string, note: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${id}/resolve`, { method: 'POST', body: { note } })
  },
  /** Autres alertes sur le même paiement ou colis, et historique (back #657) ; 404/405 sans `code` sur un ancien back. */
  getContext(id: string): Promise<AlertContext> {
    return useApi()<AlertContext>(`/admin/alerts/${id}/context`)
  },
  /** Résout jusqu'à 100 alertes avec une même note, en une requête (back #657). */
  resolveBatch(ids: string[], note: string): Promise<AlertBatchResult> {
    return useApi()<AlertBatchResult>('/admin/alerts/resolve-batch', { method: 'POST', body: { ids, note } })
  },
  reopen(id: string, note: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${id}/reopen`, { method: 'POST', body: { note } })
  },
  /** Reporte l'alerte de 1 à 168 h : elle quitte la file « ouvertes » sans être résolue. */
  snooze(id: string, hours: number, note: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${id}/snooze`, { method: 'POST', body: { hours, note } })
  },
  unsnooze(id: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${id}/snooze`, { method: 'DELETE' })
  },
}
