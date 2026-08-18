import { useApi } from '@/composables/useApi'
import type { AdminUserDetail, AdminUserPage, UsersFilterState } from '@/features/users/types/index'

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
}
