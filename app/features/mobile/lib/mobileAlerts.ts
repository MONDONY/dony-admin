import type { AdminAlert, AlertSeverity, ResolvedFilter } from '@/features/alerts/types/index'
import type { AdminNotification } from '@/features/notifications/types/index'
import { parseServerDate } from '@/lib/serverDate'
import { isUuid } from '@/lib/safeInput'

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 3, WARN: 2, INFO: 1 }

/** Gravité d'abord (critique, attention, info), puis la plus récente en premier. */
export function sortAlerts(alerts: readonly AdminAlert[]): AdminAlert[] {
  const ms = (a: AdminAlert) => {
    const t = parseServerDate(a.createdAt)
    return Number.isNaN(t) ? 0 : t
  }
  return [...alerts].sort((x, y) => (SEVERITY_RANK[y.severity] ?? 0) - (SEVERITY_RANK[x.severity] ?? 0) || ms(y) - ms(x))
}

export interface AlertChip { key: ResolvedFilter; label: string }

/** « À traiter » = ouvertes hors reportées, « En attente » = reportées, « Traitées » = résolues (filtres du back). */
export const ALERT_CHIPS: readonly AlertChip[] = [
  { key: 'OPEN', label: 'À traiter' },
  { key: 'SNOOZED', label: 'En attente' },
  { key: 'RESOLVED', label: 'Traitées' },
]

const ITEM_RE = /^[A-Z_]+:[0-9a-f-]{36}$/

export interface ItemRef { type: string; id: string }

/** Paramètre `?item=<TYPE>:<uuid>` : forme stricte, sinon rejeté (jamais utilisé tel quel). */
export function parseItemParam(raw: unknown): ItemRef | null {
  if (typeof raw !== 'string' || !ITEM_RE.test(raw)) return null
  const [type, id] = raw.split(':') as [string, string]
  return isUuid(id) ? { type, id } : null
}

function queryParam(link: string | null | undefined, name: string): string | null {
  if (typeof link !== 'string') return null
  const q = link.indexOf('?')
  if (q < 0) return null
  return new URLSearchParams(link.slice(q + 1)).get(name)
}

/** Où mène un clic sur une nouveauté du fil : alerte, billet de support, ou fiche courte « sur ordinateur ». */
export function feedItemRoute(item: Pick<AdminNotification, 'id' | 'type' | 'link'>): string {
  if (item.type === 'ADMIN_ALERT') {
    const open = queryParam(item.link, 'open')
    const id = isUuid(open) ? open : isUuid(item.id) ? item.id : null
    if (id) return `/m/alertes/${id}`
  } else if (item.type.startsWith('SUPPORT_')) {
    const ticket = queryParam(item.link, 'ticket')
    if (isUuid(ticket)) return `/m/support/${ticket}`
  }
  return parseItemParam(`${item.type}:${item.id}`) ? `/m/alertes?item=${item.type}:${item.id}` : '/m/alertes'
}
