import { useApi } from '@/composables/useApi'
import type {
  AdminBroadcast, AdminBroadcastPage, BroadcastAudience, BroadcastTarget,
} from '@/features/broadcast/types/index'

/** N'envoie que les champs pertinents : le back refuse un corridor incomplet en 422. */
function serializeTarget(target: BroadcastTarget): Record<string, string> {
  const body: Record<string, string> = { type: target.type }
  if (target.type === 'CORRIDOR') {
    if (target.origin) body.origin = target.origin
    if (target.destination) body.destination = target.destination
  }
  if (target.type === 'USER' && target.userId) body.userId = target.userId
  return body
}

export const broadcastService = {
  preview(target: BroadcastTarget): Promise<BroadcastAudience> {
    return useApi()<BroadcastAudience>('/admin/notifications/broadcast/preview', {
      method: 'POST',
      body: serializeTarget(target),
    })
  },
  send(title: string, body: string, target: BroadcastTarget): Promise<AdminBroadcast> {
    return useApi()<AdminBroadcast>('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title, body, target: serializeTarget(target) },
    })
  },
  listHistory(page: number, size: number): Promise<AdminBroadcastPage> {
    return useApi()<AdminBroadcastPage>('/admin/notifications/broadcasts', { query: { page, size } })
  },
}
