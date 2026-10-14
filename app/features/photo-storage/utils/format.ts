import { parseServerDate } from '@/lib/serverDate'

const UNKNOWN_DATE = 'Inconnue'

/** Nombre à la française, une décimale au plus (« 1,5 »). */
function fr(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

/**
 * Le back envoie des LocalDateTime UTC sans fuseau (microsecondes Java possibles) : lecture
 * via `parseServerDate`. `timeZone` est optionnel (fuseau de la machine par défaut) ; il rend
 * le rendu déterministe en test.
 */
export function formatUtc(iso: string | null, timeZone?: string): string {
  const ms = parseServerDate(iso)
  return Number.isNaN(ms)
    ? UNKNOWN_DATE
    : new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone })
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 ** 2) return `${fr(n / 1024)} Ko`
  if (n < 1024 ** 3) return `${fr(n / 1024 ** 2)} Mo`
  return `${fr(n / 1024 ** 3)} Go`
}

/** Durée d'un passage : « durée 42 s », « durée 1,5 min », ou « en cours » sans fin. */
export function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return 'en cours'
  const seconds = (parseServerDate(finishedAt) - parseServerDate(startedAt)) / 1000
  if (!(seconds >= 0)) return 'durée inconnue'
  return seconds < 60 ? `durée ${Math.round(seconds)} s` : `durée ${fr(seconds / 60)} min`
}

/** Heure locale « 14:05 » (« 14:05:09 » avec les secondes). */
export function formatClock(d: Date, withSeconds = false): string {
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
  })
}
