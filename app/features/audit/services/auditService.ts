import { useApi } from '@/composables/useApi'
import type { AdminAuditPage, AuditFilterState } from '@/features/audit/types/index'

function buildQuery(f: AuditFilterState, page: number, size: number): Record<string, string | number> {
  const q: Record<string, string | number> = { page, size }
  if (f.action) q.action = f.action
  if (f.entityType) q.entityType = f.entityType
  if (f.actorId) q.actorId = f.actorId
  if (f.from) q.from = f.from
  if (f.to) q.to = f.to
  return q
}

export const auditService = {
  list(filters: AuditFilterState, page: number, size: number): Promise<AdminAuditPage> {
    return useApi()<AdminAuditPage>('/admin/audit-log', { query: buildQuery(filters, page, size) })
  },
}
