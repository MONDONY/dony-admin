import type { AdminAlert, AlertSeverity, ResolvedFilter } from '@/features/alerts/types/index'
import type { AdminNotification } from '@/features/notifications/types/index'
import { parseServerDate } from '@/lib/serverDate'
import { isUuid } from '@/lib/safeInput'
import type { AdminPermission } from '@/stores/auth'

/**
 * Droits qui donnent des nouveautés au fil (le back le filtre selon eux) et donc des pushs vers
 * `/m/alertes?item=` : un seul suffit pour ouvrir l'onglet et la liste. Les alertes opérationnelles
 * (et leur fiche `/m/alertes/<id>`) restent réservées à ALERT_VIEW.
 */
export const ALERTS_FEED_PERMISSIONS: readonly AdminPermission[] = [
  'ALERT_VIEW', 'DISPUTE_VIEW', 'USER_KYC', 'PAYMENT_VIEW', 'REPORT_VIEW', 'USER_GDPR_DELETE', 'SUPPORT_TICKET_VIEW',
]

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

/**
 * Identifiant d'une nouveauté du fil, tel que le back l'émet : composite `<TYPE>:<uuid>`
 * (`DISPUTE_OPENED:<uuid>`, `ADMIN_ALERT:<uuid>`, `SUPPORT_MESSAGE_RECEIVED:<messageId>`).
 * Il reste opaque : on le compare entier, on ne le découpe que pour une alerte.
 */
const FEED_ID_RE = /^[A-Z_]+:[0-9a-fA-F-]{36}$/

function uuidAfterType(raw: string): string | null {
  const id = raw.slice(raw.indexOf(':') + 1)
  return isUuid(id) ? id : null
}

/** Paramètre `?item=<TYPE>:<uuid>` : l'identifiant entier du fil, de forme stricte, sinon rejeté. */
export function parseItemParam(raw: unknown): string | null {
  if (typeof raw !== 'string' || !FEED_ID_RE.test(raw)) return null
  return uuidAfterType(raw) ? raw : null
}

function queryParam(link: string | null | undefined, name: string): string | null {
  if (typeof link !== 'string') return null
  const q = link.indexOf('?')
  if (q < 0) return null
  return new URLSearchParams(link.slice(q + 1)).get(name)
}

/**
 * Où mène un clic sur une nouveauté du fil : l'alerte (`ADMIN_ALERT:<uuid>`), le billet de support
 * (`link` = `/support?ticket=<uuid>`), sinon la fiche courte `?item=<id entier>`, comme les pushs.
 */
export function feedItemRoute(item: Pick<AdminNotification, 'id' | 'type' | 'link'>): string {
  const id = parseItemParam(item.id)
  if (item.type === 'ADMIN_ALERT') {
    const alertId = id ? uuidAfterType(id) : null
    return alertId ? `/m/alertes/${alertId}` : '/m/alertes'
  }
  if (item.type.startsWith('SUPPORT_')) {
    const ticket = queryParam(item.link, 'ticket')
    if (isUuid(ticket)) return `/m/support/${ticket}`
  }
  return id ? `/m/alertes?item=${id}` : '/m/alertes'
}
