import { useApi } from '@/composables/useApi'
import type { NotificationCounters, NotificationFeed } from '@/features/notifications/types/index'

export const notificationsService = {
  feed(params: { limit: number; before?: string }): Promise<NotificationFeed> {
    const query: Record<string, string | number> = { limit: params.limit }
    if (params.before) query.before = params.before
    return useApi()<NotificationFeed>('/admin/notifications/feed', { query })
  },

  counters(): Promise<NotificationCounters> {
    return useApi()<NotificationCounters>('/admin/notifications/counters')
  },

  /** `upTo` : createdAt du plus récent élément affiché, pour ne pas avaler ce qui arrive entre-temps. */
  markSeen(upTo?: string): Promise<void> {
    return useApi()<void>('/admin/notifications/mark-seen', { method: 'POST', body: upTo ? { upTo } : {} })
  },
}
