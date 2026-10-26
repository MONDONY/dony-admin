import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import type { TimelineItem } from '@/features/signalements/reportContext'
import type { AdminAlert, AlertHistoryEntry, AlertSeverity } from '@/features/alerts/types/index'
import { parseServerDate } from '@/lib/serverDate'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type AgeTone = 'neutral' | 'warning' | 'danger'

/**
 * Ancienneté d'une alerte ouverte. Une critique en retard dès 1 jour, les autres à partir de
 * 2 jours (à surveiller) puis 7 jours (en retard) : la file se lit d'un coup d'œil.
 */
export function alertAge(alert: Pick<AdminAlert, 'createdAt' | 'severity'>, now: number = Date.now()): { label: string; tone: AgeTone } {
  const created = parseServerDate(alert.createdAt)
  const elapsed = Number.isNaN(created) ? 0 : Math.max(0, now - created)
  const lateAfter = alert.severity === 'CRITICAL' ? DAY : 7 * DAY
  const tone: AgeTone = elapsed >= lateAfter ? 'danger' : elapsed >= 2 * DAY ? 'warning' : 'neutral'
  if (elapsed < HOUR) return { label: '< 1 h', tone }
  if (elapsed < DAY) return { label: `${Math.floor(elapsed / HOUR)} h`, tone }
  return { label: `${Math.floor(elapsed / DAY)} j`, tone }
}

/** Famille de l'alerte : « Cohérence de l'argent · INV-06 » et « … · INV-02 » forment une seule catégorie. */
export function alertCategory(type: string): string {
  return alertGuide(type).category.split(' · ')[0]!
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 3, WARN: 2, INFO: 1 }

export interface AlertGroup {
  /** Titre en clair : les alertes d'un même type (suffixées d'un identifiant) partagent la clé. */
  key: string
  title: string
  category: string
  /** La plus grave des alertes du groupe. */
  severity: AlertSeverity
  /** De la plus ancienne à la plus récente : on traite d'abord celle qui attend depuis le plus longtemps. */
  alerts: AdminAlert[]
}

function createdMs(a: Pick<AdminAlert, 'createdAt'>): number {
  const ms = parseServerDate(a.createdAt)
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms
}

/** Alertes de même type regroupées ; groupes triés par gravité puis par ancienneté de leur plus vieille alerte. */
export function groupAlerts(alerts: readonly AdminAlert[]): AlertGroup[] {
  const byKey = new Map<string, AlertGroup>()
  for (const a of alerts) {
    const guide = alertGuide(a.type)
    const group = byKey.get(guide.title)
    if (group) {
      group.alerts.push(a)
      if (SEVERITY_RANK[a.severity] > SEVERITY_RANK[group.severity]) group.severity = a.severity
    } else {
      byKey.set(guide.title, { key: guide.title, title: guide.title, category: alertCategory(a.type), severity: a.severity, alerts: [a] })
    }
  }
  const groups = [...byKey.values()]
  for (const g of groups) g.alerts.sort((x, y) => createdMs(x) - createdMs(y))
  return groups.sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity] || createdMs(x.alerts[0]!) - createdMs(y.alerts[0]!))
}

/** Alertes dans l'ordre d'affichage de la file : ce que J et K parcourent. */
export function queueOrder(groups: readonly AlertGroup[]): AdminAlert[] {
  return groups.flatMap((g) => g.alerts)
}

/** Catégories présentes dans la liste, dans l'ordre de première apparition. */
export function alertCategories(alerts: readonly AdminAlert[]): string[] {
  return [...new Set(alerts.map((a) => alertCategory(a.type)))]
}

export interface QueueFilter {
  query: string
  category: string | null
}

/** Recherche libre (titre, code, phrase, identifiants de la levée) et catégorie. */
export function filterAlerts(alerts: readonly AdminAlert[], { query, category }: QueueFilter): AdminAlert[] {
  const q = query.trim().toLowerCase()
  return alerts.filter((a) => {
    const guide = alertGuide(a.type)
    if (category && alertCategory(a.type) !== category) return false
    if (!q) return true
    const haystack = `${guide.title} ${a.type} ${a.detail ?? ''} ${a.paymentId ?? ''} ${JSON.stringify(a.payload ?? {})}`.toLowerCase()
    return haystack.includes(q)
  })
}

export interface AlertSummary {
  critical: number
  warn: number
  info: number
  /** Âge de la plus ancienne critique ouverte, null s'il n'y en a aucune. */
  oldestCritical: string | null
  warnGroups: number
  resolvedThisWeek: number
}

/** Compteurs du bandeau : alertes ouvertes par sévérité, et résolues depuis 7 jours. */
export function summarizeAlerts(open: readonly AdminAlert[], resolved: readonly AdminAlert[], now: number = Date.now()): AlertSummary {
  const critical = open.filter((a) => a.severity === 'CRITICAL')
  const warn = open.filter((a) => a.severity === 'WARN')
  const oldest = [...critical].sort((x, y) => createdMs(x) - createdMs(y))[0]
  return {
    critical: critical.length,
    warn: warn.length,
    info: open.filter((a) => a.severity === 'INFO').length,
    oldestCritical: oldest ? alertAge(oldest, now).label : null,
    warnGroups: groupAlerts(warn).length,
    resolvedThisWeek: resolved.filter((a) => {
      const at = parseServerDate(a.resolvedAt)
      return !Number.isNaN(at) && now - at <= 7 * DAY
    }).length,
  }
}

// ---- Décision ----

export type AlertAction = 'FIXED' | 'FALSE_POSITIVE' | 'SNOOZE' | 'UNSNOOZE' | 'REOPEN'
/** Une alerte, ou toutes les alertes ouvertes de son groupe. */
export type DecisionScope = 'one' | 'group'

export const ALERT_ACTION_LABELS: Record<AlertAction, string> = {
  FIXED: 'Résoudre : corrigé',
  FALSE_POSITIVE: 'Résoudre : faux positif',
  SNOOZE: 'Reporter',
  UNSNOOZE: 'Remettre dans la file',
  REOPEN: 'Rouvrir l’alerte',
}
export const ALERT_ACTION_HELP: Record<AlertAction, string> = {
  FIXED: 'Le problème a été traité ou n’existe plus.',
  FALSE_POSITIVE: 'La règle s’est trompée : rien à corriger.',
  SNOOZE: 'Reste ouverte mais quitte la file jusqu’à la date choisie.',
  UNSNOOZE: 'L’alerte reportée revient dans la file tout de suite.',
  REOPEN: 'L’anomalie est revenue ou la résolution était trop rapide.',
}
/** Préfixe de la note quand le geste est un faux positif : l'Audit le dit sans que l'admin l'écrive. */
const FALSE_POSITIVE_PREFIX = 'Faux positif : '

export const ALERT_NOTE_MIN = 3
export const ALERT_NOTE_MAX = 500

export const QUICK_NOTES: Record<AlertAction, string[]> = {
  FIXED: ['Corrigé manuellement', 'Remboursé via Stripe', 'Versement forcé', 'Déjà traité'],
  FALSE_POSITIVE: ['Règle trop sensible', 'Opération en cours, rien à faire', 'Doublon d’une autre alerte'],
  SNOOZE: ['Colis encore en route', 'En attente du voyageur', 'À revoir demain'],
  UNSNOOZE: [],
  REOPEN: ['L’anomalie est revenue', 'Résolue trop vite'],
}

/** Durées de report proposées ; le back accepte 1 à 168 h. */
export const SNOOZE_CHOICES: { hours: number; label: string }[] = [
  { hours: 4, label: '4 h' },
  { hours: 24, label: '24 h' },
  { hours: 72, label: '3 jours' },
  { hours: 168, label: '7 jours' },
]
export const DEFAULT_SNOOZE_HOURS = 24

/** Reportée jusqu'à une date encore à venir. */
export function isSnoozed(alert: Pick<AdminAlert, 'resolved' | 'snoozedUntil'>, now: number = Date.now()): boolean {
  if (alert.resolved || !alert.snoozedUntil) return false
  const until = parseServerDate(alert.snoozedUntil)
  return !Number.isNaN(until) && until > now
}

/** Gestes proposés selon l'état : résoudre (ou rouvrir si déjà résolue), reporter ou remettre dans la file. */
export function alertActionsFor(alert: Pick<AdminAlert, 'resolved' | 'snoozedUntil'>, now: number = Date.now()): AlertAction[] {
  if (alert.resolved) return ['REOPEN']
  return ['FIXED', 'FALSE_POSITIVE', isSnoozed(alert, now) ? 'UNSNOOZE' : 'SNOOZE']
}

/** Le retour dans la file n'a besoin d'aucune note ; tout autre geste est tracé avec la sienne. */
export function isNoteRequired(action: AlertAction): boolean {
  return action !== 'UNSNOOZE'
}

/** Gestes qu'on peut appliquer à tout un groupe d'un coup. */
export function isGroupAction(action: AlertAction): boolean {
  return action === 'FIXED' || action === 'FALSE_POSITIVE'
}

export function alertNoteError(note: string, action: AlertAction = 'FIXED'): string | null {
  if (!isNoteRequired(action) && !note.trim()) return null
  const n = note.trim().length
  if (n < ALERT_NOTE_MIN) return `Indiquez ce qui a été fait (${ALERT_NOTE_MIN} caractères au moins).`
  if (n > ALERT_NOTE_MAX) return `Note trop longue (${ALERT_NOTE_MAX} caractères au plus).`
  return null
}

/** Note envoyée au back : l'audit est sa seule trace, le faux positif y est nommé. */
export function alertNoteFor(action: AlertAction, note: string): string {
  const clean = note.trim()
  return action === 'FALSE_POSITIVE' ? `${FALSE_POSITIVE_PREFIX}${clean}` : clean
}

// ---- Historique ----

const AUDIT_LABELS: Record<string, string> = {
  ADMIN_ALERT_RESOLVED: 'Alerte résolue',
  ADMIN_ALERT_REOPENED: 'Alerte rouverte',
  ADMIN_ALERT_SNOOZED: 'Alerte reportée',
  ADMIN_ALERT_UNSNOOZED: 'Alerte remise dans la file',
}

/**
 * Chronologie d'une alerte, de la plus ancienne à la plus récente : la levée, puis chaque geste tracé
 * (le back les rend du plus récent au plus ancien).
 */
export function buildAlertTimeline(
  alert: Pick<AdminAlert, 'id' | 'createdAt'>,
  history: readonly AlertHistoryEntry[] | null | undefined,
): TimelineItem[] {
  const raised: TimelineItem = { key: `raised-${alert.id}`, label: 'Alerte levée', at: alert.createdAt, by: null, note: null }
  const steps = [...(history ?? [])].reverse().map((e, i): TimelineItem => ({
    key: `${e.action}-${i}`, label: AUDIT_LABELS[e.action] ?? e.action, at: e.at ?? null,
    by: e.actorEmail ? `par ${e.actorEmail}` : null, note: e.note ?? null,
  }))
  return [raised, ...steps]
}

// ---- Sélection ----

export function defaultAlertId(order: readonly AdminAlert[]): string | null {
  return order[0]?.id ?? null
}

/** Voisin dans la file (J / K) ; sans sélection, la première. Reste sur place aux extrémités. */
export function neighbourAlertId(order: readonly AdminAlert[], currentId: string | null, step: 1 | -1): string | null {
  if (order.length === 0) return null
  const from = order.findIndex((a) => a.id === currentId)
  if (from === -1) return order[0]!.id
  return order[Math.min(order.length - 1, Math.max(0, from + step))]!.id
}

/** Après un geste : l'alerte suivante, à défaut la précédente ; null s'il n'en reste aucune. */
export function followingAlertId(order: readonly AdminAlert[], currentId: string | null): string | null {
  const from = order.findIndex((a) => a.id === currentId)
  if (from === -1) return order[0]?.id ?? null
  return order[from + 1]?.id ?? order[from - 1]?.id ?? null
}
