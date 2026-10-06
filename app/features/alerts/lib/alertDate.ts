import { parseServerDate } from '@/lib/serverDate'

/** Date d'alerte du back (UTC sans fuseau) affichée en heure locale ; « — » si illisible. */
export function formatAlertDate(value: string | null | undefined): string {
  const ms = parseServerDate(value)
  return Number.isNaN(ms) ? '—' : new Date(ms).toLocaleString('fr-FR')
}
