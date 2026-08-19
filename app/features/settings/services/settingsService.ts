import { useApi } from '@/composables/useApi'
import type { PlatformSetting } from '@/features/settings/types/index'

export const settingsService = {
  list(): Promise<PlatformSetting[]> {
    return useApi()<PlatformSetting[]>('/admin/settings')
  },
  update(key: string, value: string): Promise<PlatformSetting> {
    return useApi()<PlatformSetting>(`/admin/settings/${key}`, { method: 'PUT', body: { value } })
  },
}
