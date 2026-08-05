import { useApi } from '@/composables/useApi'
import type { AdminAccountPage, TemporaryCredentials, ManagedAdminRole, AdminStatus } from '@/features/admin-accounts/types/index'

export const adminAccountsService = {
  list(page: number, size: number): Promise<AdminAccountPage> {
    return useApi()<AdminAccountPage>('/admin/admins', { query: { page, size } })
  },

  create(email: string, role: ManagedAdminRole): Promise<TemporaryCredentials> {
    return useApi()<TemporaryCredentials>('/admin/admins', {
      method: 'POST',
      body: { email, role },
    })
  },

  update(id: string, update: { role?: ManagedAdminRole; status?: AdminStatus }): Promise<void> {
    return useApi()<void>(`/admin/admins/${id}`, {
      method: 'PATCH',
      body: update,
    })
  },

  resetPassword(id: string): Promise<TemporaryCredentials> {
    return useApi()<TemporaryCredentials>(`/admin/admins/${id}/reset-password`, { method: 'POST' })
  },
}
