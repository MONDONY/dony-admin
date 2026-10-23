const fmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' })

/** Instant ISO affiché en date et heure de Paris, quel que soit le fuseau du navigateur. */
export function formatInstant(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : fmt.format(d)
}
