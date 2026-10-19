import { parseServerDate } from '@/lib/serverDate'

/**
 * Dates de l'onglet Tarification. Le back lit et écrit `effectiveFrom` en `LocalDateTime` UTC sans
 * fuseau ; le propriétaire, lui, raisonne en heure de Paris, quel que soit le fuseau du navigateur
 * (un admin en déplacement à Dakar ne doit pas programmer une grille deux heures trop tôt).
 * D'où un fuseau explicite, et non l'heure locale de `maintenance/utils/datetime.ts`.
 */
const PARIS = 'Europe/Paris'
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
const INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

const pad = (n: number) => String(n).padStart(2, '0')

let partsFormatter: Intl.DateTimeFormat | null = null
interface Parts { year: number; month: number; day: number; hour: number; minute: number; second: number }

/** Composantes de l'instant `ms` lues à Paris. */
function parisParts(ms: number): Parts {
  partsFormatter ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: PARIS, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const out: Record<string, number> = {}
  for (const p of partsFormatter.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return out as unknown as Parts
}

/** Décalage de Paris sur l'UTC à l'instant `ms` (une ou deux heures, selon l'heure d'été). */
function parisOffsetMs(ms: number): number {
  const p = parisParts(ms)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** Date du back (UTC sans fuseau) → valeur d'un `<input type="datetime-local">` en heure de Paris. */
export function utcToParisInput(value: string | null | undefined): string {
  const ms = parseServerDate(value)
  if (Number.isNaN(ms)) return ''
  const p = parisParts(ms)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * Saisie en heure de Paris → `LocalDateTime` UTC attendu par le back (`2026-11-01T00:00:00`) ;
 * vide ou illisible = `null` (effet immédiat). Le décalage est relu à l'instant obtenu : une saisie
 * proche du changement d'heure tombe ainsi sur le bon côté.
 */
export function parisInputToUtc(value: string | null | undefined): string | null {
  const m = INPUT.exec((value ?? '').trim())
  if (!m) return null
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
  const guess = naive - parisOffsetMs(naive)
  const utc = naive - parisOffsetMs(guess)
  return new Date(utc).toISOString().slice(0, 19)
}

/** « 1 novembre 2026 à 01:00 », heure de Paris ; chaîne vide si la date est absente. */
export function formatParis(value: string | null | undefined): string {
  const ms = parseServerDate(value)
  if (Number.isNaN(ms)) return ''
  const p = parisParts(ms)
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year} à ${pad(p.hour)}:${pad(p.minute)}`
}
