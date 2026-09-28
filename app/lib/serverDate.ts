/**
 * Dates reçues du back. Ses `LocalDateTime` sont écrits en UTC (`LocalDateTime.now(ZoneOffset.UTC)`,
 * `jdbc.time_zone: UTC`) mais sérialisés SANS fuseau : `Date.parse` les lirait en heure locale du
 * navigateur (deux heures d'écart l'été à Paris). Une date seule (`YYYY-MM-DD`) reste telle quelle.
 */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/i

/** Chaîne ISO lisible sans ambiguïté : `Z` ajouté quand elle n'a ni `Z` ni décalage. */
export function serverDateIso(value: string): string {
  const m = DATE_TIME.exec(value)
  if (!m || m[3]) return value
  return `${value}Z`
}

/** Instant en millisecondes, NaN si vide ou illisible. Microsecondes Java tronquées. */
export function parseServerDate(value: string | null | undefined): number {
  if (!value) return NaN
  const m = DATE_TIME.exec(value)
  if (!m) return Date.parse(value)
  const millis = m[2] ? `.${m[2].padEnd(3, '0').slice(0, 3)}` : ''
  let zone = m[3] ?? 'Z'
  if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`
  return Date.parse(`${m[1]}${millis}${zone}`)
}
