import { useApi } from '@/composables/useApi'
import type { AdminOverview } from '@/features/overview/types/index'

export const overviewService = {
  fetch(): Promise<AdminOverview> {
    return useApi()<AdminOverview>('/admin/metrics/overview')
  },
}
