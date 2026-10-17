import { useApi } from '@/composables/useApi'
import type {
  AdminGpProApplicationDetail, AdminGpProApplicationRow, AdminGpProReviewRow, SpringPage,
} from '@/features/gp-pro/types/index'

/** Badge GP Pro côté administration (GP_PRO_REVIEW), yadony-back #560. */
export const gpProService = {
  listApplications(page: number, size: number): Promise<SpringPage<AdminGpProApplicationRow>> {
    return useApi()<SpringPage<AdminGpProApplicationRow>>('/admin/gp-pro/applications', {
      query: { status: 'PENDING', page, size },
    })
  },
  getApplication(id: string): Promise<AdminGpProApplicationDetail> {
    return useApi()<AdminGpProApplicationDetail>(`/admin/gp-pro/applications/${id}`)
  },
  approve(id: string): Promise<void> {
    return useApi()<void>(`/admin/gp-pro/applications/${id}/approve`, { method: 'POST' })
  },
  reject(id: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/gp-pro/applications/${id}/reject`, { method: 'POST', body: { reason } })
  },
  listReview(page: number, size: number): Promise<SpringPage<AdminGpProReviewRow>> {
    return useApi()<SpringPage<AdminGpProReviewRow>>('/admin/gp-pro/review', { query: { page, size } })
  },
  dismissFlag(flagId: string): Promise<void> {
    return useApi()<void>(`/admin/gp-pro/review-flags/${flagId}/dismiss`, { method: 'POST' })
  },
  /** Attribution sans demande ; la note est facultative et reste côté admin. */
  grant(userId: string, note: string | null): Promise<void> {
    return useApi()<void>(`/admin/users/${userId}/gp-pro/grant`, {
      method: 'POST', body: note ? { note } : {},
    })
  },
  revoke(userId: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/users/${userId}/gp-pro/revoke`, { method: 'POST', body: { reason } })
  },
}
