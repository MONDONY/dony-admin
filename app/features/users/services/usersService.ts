import { useApi } from '@/composables/useApi'
import type {
  AdminDeletionReasonCode, AdminGdprRequestPage, AdminKycDetail, AdminUserDetail, AdminUserPage,
  DeletionImpact, UsersFilterState,
} from '@/features/users/types/index'

function buildQuery(f: UsersFilterState, page: number, size: number): Record<string, string | number | boolean> {
  const q: Record<string, string | number | boolean> = { page, size }
  if (f.status && f.status !== 'TOUS') q.status = f.status
  if (f.role) q.role = f.role
  if (f.kyc) q.kyc = f.kyc
  if (f.pro !== null) q.pro = f.pro
  if (f.city) q.city = f.city
  if (f.query.trim()) q.query = f.query.trim()
  return q
}

export const usersService = {
  list(filters: UsersFilterState, page: number, size: number): Promise<AdminUserPage> {
    return useApi()<AdminUserPage>('/admin/users', { query: buildQuery(filters, page, size) })
  },
  get(id: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${id}`)
  },
  suspend(id: string, reason: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${id}/suspend`, { method: 'POST', body: { reason } })
  },
  ban(id: string, reason: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${id}/ban`, { method: 'POST', body: { reason } })
  },
  unsuspend(id: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${id}/unsuspend`, { method: 'POST' })
  },
  setCommissionRate(id: string, rate: number | null): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${id}/commission-rate`, { method: 'PUT', body: { rate } })
  },
  suspendPublishing(id: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/users/${id}/suspend-publishing`, { method: 'POST', query: { reason } })
  },
  liftPublishingSuspension(id: string): Promise<void> {
    return useApi()<void>(`/admin/users/${id}/lift-publishing-suspension`, { method: 'POST' })
  },
  muteMessaging(id: string, durationHours: number | null, reason: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${id}/mute-messaging`, {
      method: 'POST',
      body: { durationHours, reason },
    })
  },
  unmuteMessaging(id: string): Promise<AdminUserDetail> {
    return useApi()<AdminUserDetail>(`/admin/users/${id}/unmute-messaging`, { method: 'POST' })
  },
  getKyc(id: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${id}/kyc`)
  },
  resetKyc(id: string, reason: string): Promise<AdminKycDetail> {
    return useApi()<AdminKycDetail>(`/admin/users/${id}/kyc/reset`, { method: 'POST', body: { reason } })
  },
  listGdprRequests(page: number, size: number): Promise<AdminGdprRequestPage> {
    return useApi()<AdminGdprRequestPage>('/admin/users/gdpr-requests', { query: { page, size } })
  },
  /** Irréversible : le back répond 204 sans corps. */
  executeGdprDeletion(id: string, reason: string): Promise<void> {
    return useApi()<void>(`/admin/users/${id}/gdpr-execute`, { method: 'POST', body: { reason } })
  },
  getDeletionImpact(id: string): Promise<DeletionImpact> {
    return useApi()<DeletionImpact>(`/admin/users/${id}/deletion-impact`)
  },
  /** Irréversible : le compte est anonymisé et banni. Le back répond 204 sans corps. */
  deleteUser(id: string, reasonCode: AdminDeletionReasonCode, reason: string): Promise<void> {
    return useApi()<void>(`/admin/users/${id}/delete`, {
      method: 'POST',
      body: { reasonCode, reason },
    })
  },
}
