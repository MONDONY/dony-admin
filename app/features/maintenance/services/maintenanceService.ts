import { useApi } from '@/composables/useApi'
import type { MaintenanceState, MaintenanceUpdate } from '@/features/maintenance/types/index'

export const maintenanceService = {
  get(): Promise<MaintenanceState> {
    return useApi()<MaintenanceState>('/admin/maintenance')
  },
  update(body: MaintenanceUpdate): Promise<MaintenanceState> {
    return useApi()<MaintenanceState>('/admin/maintenance', { method: 'PUT', body })
  },
  addExemption(userId: string, note: string | null): Promise<MaintenanceState> {
    return useApi()<MaintenanceState>('/admin/maintenance/exemptions', { method: 'POST', body: { userId, note } })
  },
  removeExemption(userId: string): Promise<MaintenanceState> {
    return useApi()<MaintenanceState>(`/admin/maintenance/exemptions/${userId}`, { method: 'DELETE' })
  },
}
