import { useApi } from '@/composables/useApi'
import type { AppUpdateState, AppUpdateWrite } from '@/features/app-update/types/index'

export const appUpdateService = {
  get(): Promise<AppUpdateState> {
    return useApi()<AppUpdateState>('/admin/app-update')
  },
  update(body: AppUpdateWrite): Promise<AppUpdateState> {
    return useApi()<AppUpdateState>('/admin/app-update', { method: 'PUT', body })
  },
}
