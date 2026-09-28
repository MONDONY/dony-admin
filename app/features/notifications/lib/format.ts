const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto', style: 'short' })
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })
const fullDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' })

/** Libellé d'une pastille : « 99+ » au-delà de 99 ou quand le back a plafonné son comptage. */
export function badgeLabel(count: number, capped = false): string {
  return capped || count > 99 ? '99+' : String(count)
}

const ISO = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/

/**
 * Instant en microsecondes. Le back émet de l'ISO UTC avec 0, 3 ou 6 décimales
 * (`Instant` Java) ; `Date.parse` refuse les microsecondes et les perdrait de toute façon,
 * alors que deux notifications peuvent tomber dans la même milliseconde que lastSeenAt.
 */
function parseMicros(iso: string): number | null {
  const m = ISO.exec(iso)
  if (!m) {
    const t = Date.parse(iso)
    return Number.isNaN(t) ? null : t * 1000
  }
  const zone = m[3] ?? 'Z'
  const base = Date.parse(m[1]! + (zone.length === 5 ? `${zone.slice(0, 3)}:${zone.slice(3)}` : zone))
  if (Number.isNaN(base)) return null
  return base * 1000 + Number(`${m[2] ?? ''}000000`.slice(0, 6))
}

function parse(iso: string): number | null {
  const us = parseMicros(iso)
  return us === null ? null : Math.floor(us / 1000)
}

/** « à l’instant », « il y a 5 min », « il y a 3 h », « hier », puis « le 1 sept. » au-delà d'une semaine. */
export function formatRelativeFr(iso: string, now: number = Date.now()): string {
  const t = parse(iso)
  if (t === null) return ''
  const diff = Math.max(0, now - t)
  if (diff < MINUTE) return 'à l’instant'
  if (diff < HOUR) return relative.format(-Math.floor(diff / MINUTE), 'minute')
  if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), 'hour')
  if (diff < 7 * DAY) return relative.format(-Math.floor(diff / DAY), 'day')
  return `le ${shortDate.format(t)}`
}

/** Date complète affichée au survol, ex. « lundi 28 septembre 2026 à 12:00 ». */
export function formatFullDate(iso: string): string {
  const t = parse(iso)
  return t === null ? '' : fullDate.format(t)
}

export function formatTabTitle(title: string, unread: number, capped = false): string {
  return unread > 0 ? `(${badgeLabel(unread, capped)}) ${title}` : title
}

/**
 * Le lien vient du back mais on ne suit qu'une route interne de l'admin : ni URL absolue,
 * ni `//hote` (protocole-relatif), ni `/\hote` que certains navigateurs normalisent en `//`.
 */
export function isSafeInternalLink(link: string | null | undefined): link is string {
  if (typeof link !== 'string' || !link.startsWith('/')) return false
  return !link.startsWith('//') && !link.startsWith('/\\')
}

/** Non lu : postérieur au dernier passage, ou rien n'a jamais été vu. */
export function isUnread(createdAt: string, lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return true
  const c = parseMicros(createdAt)
  const s = parseMicros(lastSeenAt)
  if (c === null || s === null) return false
  return c > s
}
