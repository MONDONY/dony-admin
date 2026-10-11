import { useApi } from '@/composables/useApi'
import type { PhotoStorageStatus } from '@/features/photo-storage/types/index'

export const photoStorageService = {
  status(): Promise<PhotoStorageStatus> {
    return useApi()<PhotoStorageStatus>('/admin/storage/photo-purge/status')
  },
  runPurge(): Promise<{ started: boolean }> {
    return useApi()<{ started: boolean }>('/admin/storage/photo-purge/run', { method: 'POST' })
  },
  /** `allowBulk` lève la garde de volume pour CE passage seulement. */
  reconcile(allowBulk: boolean): Promise<{ started: boolean }> {
    return useApi()<{ started: boolean }>('/admin/storage/photo-purge/reconcile', {
      method: 'POST',
      query: allowBulk ? { allowBulk: true } : {},
    })
  },
}
