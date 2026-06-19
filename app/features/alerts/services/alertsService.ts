import { useApi } from '@/composables/useApi'
import type { AdminAlert, AdminAlertPage, AlertsFilterState } from '@/features/alerts/types/index'

function buildQuery(f: AlertsFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.type) q.type = f.type
  if (f.severity) q.severity = f.severity
  if (f.resolved === 'OPEN') q.resolved = false
  else if (f.resolved === 'RESOLVED') q.resolved = true
  return q
}

export const alertsService = {
  list(filters: AlertsFilterState, page: number, size: number): Promise<AdminAlertPage> {
    return useApi()<AdminAlertPage>('/admin/alerts', { query: buildQuery(filters, page, size) })
  },
  resolve(id: string, note: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${id}/resolve`, { method: 'POST', body: { note } })
  },
}
