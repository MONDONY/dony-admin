import { useApi } from '@/composables/useApi'
import { downloadBlob } from '@/lib/downloadBlob'
import { serializeRule } from '@/features/broadcast/composables/audienceRule'
import type {
  AdminBroadcast, AdminBroadcastPage, AudienceField, BroadcastAudience, BroadcastRecipientPage,
  BroadcastSegment, BroadcastSegmentPage, BroadcastTarget, RuleGroup,
} from '@/features/broadcast/types/index'

/**
 * N'envoie que les champs pertinents : le back refuse un corridor incomplet en 422.
 * `RULE` : `rule` OU `segmentId`, jamais les deux (le back répond 422 sinon) ; la règle prime.
 */
function serializeTarget(target: BroadcastTarget): Record<string, unknown> {
  const body: Record<string, unknown> = { type: target.type }
  if (target.type === 'RULE') {
    if (target.rule) body.rule = serializeRule(target.rule)
    else if (target.segmentId) body.segmentId = target.segmentId
  }
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
  /**
   * `push` : faire aussi sonner les téléphones. Toujours envoyé explicitement : un back qui
   * ne le reçoit pas garde l'ancien comportement (push), ce qui ne doit plus arriver d'ici.
   */
  send(title: string, body: string, target: BroadcastTarget, push: boolean): Promise<AdminBroadcast> {
    return useApi()<AdminBroadcast>('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title, body, target: serializeTarget(target), push },
    })
  },
  listHistory(page: number, size: number): Promise<AdminBroadcastPage> {
    return useApi()<AdminBroadcastPage>('/admin/notifications/broadcasts', { query: { page, size } })
  },
  fields(): Promise<AudienceField[]> {
    return useApi()<AudienceField[]>('/admin/notifications/broadcast/fields')
  },
  recipients(target: BroadcastTarget, page: number, size: number): Promise<BroadcastRecipientPage> {
    return useApi()<BroadcastRecipientPage>('/admin/notifications/broadcast/recipients', {
      method: 'POST', query: { page, size }, body: serializeTarget(target),
    })
  },
  /** Export CSV (sans coordonnées, 50 000 lignes au plus côté back) puis téléchargement. */
  async downloadRecipientsCsv(target: BroadcastTarget): Promise<void> {
    const blob = await useApi()<Blob>('/admin/notifications/broadcast/recipients.csv', {
      method: 'POST', body: serializeTarget(target), responseType: 'blob',
    })
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    downloadBlob(blob, `destinataires-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`)
  },
  segments: {
    list(page: number, size: number): Promise<BroadcastSegmentPage> {
      return useApi()<BroadcastSegmentPage>('/admin/broadcast-segments', { query: { page, size } })
    },
    get(id: string): Promise<BroadcastSegment> {
      return useApi()<BroadcastSegment>(`/admin/broadcast-segments/${id}`)
    },
    create(name: string, description: string | null, rule: RuleGroup): Promise<BroadcastSegment> {
      return useApi()<BroadcastSegment>('/admin/broadcast-segments', {
        method: 'POST', body: { name, description, rule: serializeRule(rule) },
      })
    },
    update(id: string, name: string, description: string | null, rule: RuleGroup): Promise<BroadcastSegment> {
      return useApi()<BroadcastSegment>(`/admin/broadcast-segments/${id}`, {
        method: 'PUT', body: { name, description, rule: serializeRule(rule) },
      })
    },
    remove(id: string): Promise<void> {
      return useApi()<void>(`/admin/broadcast-segments/${id}`, { method: 'DELETE' })
    },
  },
}
