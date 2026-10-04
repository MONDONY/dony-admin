import { useApi } from '@/composables/useApi'
import { reportKindQuery } from '@/features/signalements/reportKind'
import type {
  AdminReport, AdminReportPage, BulkRestoreResult, ReportAction, ReportReplyPayload, ReportReplyResponse, ReportsFilterState,
} from '@/features/signalements/types/index'

/** Recherche envoyée au back : le texte libre, sinon le préfixe du type de retour. */
function searchText(f: ReportsFilterState): string | undefined {
  const text = f.q?.trim()
  if (text) return text
  return f.kind ? reportKindQuery(f.kind) : undefined
}

function buildQuery(f: ReportsFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  // Les supprimés se consultent tous statuts confondus : le statut n'a plus de sens.
  if (f.deleted) q.deleted = true
  else if (f.status !== 'ALL') q.status = f.status
  if (f.targetType) q.targetType = f.targetType
  const search = searchText(f)
  if (search) q.q = search
  return q
}

/** Corps de POST /admin/reports/bulk-delete : une sélection, ou tout le filtre courant. */
export type BulkDeleteInput = { ids: string[] } | { all: true; filters: ReportsFilterState }

export const reportsService = {
  list(filters: ReportsFilterState, page: number, size: number): Promise<AdminReportPage> {
    return useApi()<AdminReportPage>('/admin/reports', { query: buildQuery(filters, page, size) })
  },
  /** Un signalement par son identifiant (lien profond `?open=`). */
  get(id: string): Promise<AdminReport> {
    return useApi()<AdminReport>(`/admin/reports/${id}`)
  },
  /**
   * Répondre au signalant d'un rapport de bug : le back crée (ou réutilise) la conversation
   * support avec lui. Le signalement garde son statut. 403, 404, 422 `report-not-app-bug`,
   * `reporter-unavailable`, 422 de validation ; 404/405 sans code sur un ancien back.
   */
  reply(id: string, payload: ReportReplyPayload): Promise<ReportReplyResponse> {
    return useApi()<ReportReplyResponse>(`/admin/reports/${encodeURIComponent(id)}/reply`, { method: 'POST', body: payload })
  },
  /** `action` peut être une valeur de `availableActions` que ce front ne connaît pas encore. */
  resolve(id: string, action: ReportAction | string, note: string): Promise<AdminReport> {
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
          q: searchText(input.filters),
        }
    return useApi()<{ deleted: number }>('/admin/reports/bulk-delete', { method: 'POST', body })
  },
  /** Restaure un signalement supprimé (REPORT_DELETE) ; 409 `report-not-deleted` s'il est actif. */
  restore(id: string, reason: string): Promise<AdminReport> {
    return useApi()<AdminReport>(`/admin/reports/${id}/restore`, { method: 'POST', body: { reason } })
  },
  /** Restauration groupée, 100 identifiants au plus ; `skipped` = déjà actifs ou introuvables. */
  bulkRestore(ids: string[]): Promise<BulkRestoreResult> {
    return useApi()<BulkRestoreResult>('/admin/reports/bulk-restore', { method: 'POST', body: { ids } })
  },
}
