import { useApi } from '@/composables/useApi'
import type { AdminReport, AdminReportPage, ReportAction, ReportsFilterState } from '@/features/signalements/types/index'

function buildQuery(f: ReportsFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.status !== 'ALL') q.status = f.status
  if (f.targetType) q.targetType = f.targetType
  return q
}

export const reportsService = {
  list(filters: ReportsFilterState, page: number, size: number): Promise<AdminReportPage> {
    return useApi()<AdminReportPage>('/admin/reports', { query: buildQuery(filters, page, size) })
  },
  resolve(id: string, action: ReportAction, note: string): Promise<AdminReport> {
    return useApi()<AdminReport>(`/admin/reports/${id}/resolve`, { method: 'POST', body: { action, note } })
  },
}
