import { useApi } from '@/composables/useApi'
import type { AdminReport, AdminReportPage, ReportAction, ReportsFilterState } from '@/features/signalements/types/index'

function buildQuery(f: ReportsFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.status !== 'ALL') q.status = f.status
  if (f.targetType) q.targetType = f.targetType
  if (f.q && f.q.trim()) q.q = f.q.trim()
  return q
}

/** Corps de POST /admin/reports/bulk-delete : une sélection, ou tout le filtre courant. */
export type BulkDeleteInput = { ids: string[] } | { all: true; filters: ReportsFilterState }

export const reportsService = {
  list(filters: ReportsFilterState, page: number, size: number): Promise<AdminReportPage> {
    return useApi()<AdminReportPage>('/admin/reports', { query: buildQuery(filters, page, size) })
  },
  resolve(id: string, action: ReportAction, note: string): Promise<AdminReport> {
    return useApi()<AdminReport>(`/admin/reports/${id}/resolve`, { method: 'POST', body: { action, note } })
  },
  /** Suppression douce d’un signalement (yadony-back #318). */
  remove(id: string): Promise<void> {
    return useApi()<void>(`/admin/reports/${id}`, { method: 'DELETE' })
  },
  /** Suppression douce groupée ; rend le nombre réellement supprimé. */
  bulkDelete(input: BulkDeleteInput): Promise<{ deleted: number }> {
    const body = 'ids' in input
      ? { ids: input.ids }
      : {
          all: true,
          status: input.filters.status === 'ALL' ? undefined : input.filters.status,
          targetType: input.filters.targetType ?? undefined,
          q: input.filters.q?.trim() || undefined,
        }
    return useApi()<{ deleted: number }>('/admin/reports/bulk-delete', { method: 'POST', body })
  },
}
