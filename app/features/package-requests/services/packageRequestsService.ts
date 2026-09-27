import { useApi } from '@/composables/useApi'
import type { AdminPackageRequestDetail, AdminPackageRequestPage, PackageRequestFilters } from '@/features/package-requests/types/index'

function buildQuery(f: PackageRequestFilters, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.status !== 'ALL') q.status = f.status
  if (f.query.trim()) q.query = f.query.trim()
  if (f.reportedOnly) q.reportedOnly = true
  if (f.from) q.from = f.from
  if (f.to) q.to = f.to
  return q
}

export const packageRequestsService = {
  list(filters: PackageRequestFilters, page: number, size: number): Promise<AdminPackageRequestPage> {
    return useApi()<AdminPackageRequestPage>('/admin/package-requests', { query: buildQuery(filters, page, size) })
  },
  get(id: string): Promise<AdminPackageRequestDetail> {
    return useApi()<AdminPackageRequestDetail>(`/admin/package-requests/${id}`)
  },
  /** `publicReason` (catalogue) part à l'expéditeur ; `internalNote` reste dans l'audit. */
  remove(id: string, publicReason: string, internalNote: string): Promise<AdminPackageRequestDetail> {
    return useApi()<AdminPackageRequestDetail>(`/admin/package-requests/${id}/remove`, {
      method: 'POST', body: { publicReason, internalNote },
    })
  },
  restore(id: string): Promise<AdminPackageRequestDetail> {
    return useApi()<AdminPackageRequestDetail>(`/admin/package-requests/${id}/restore`, { method: 'POST' })
  },
}
