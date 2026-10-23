/** Jour calendaire envoyé comme minuit UTC : formaté en UTC pour ne pas reculer d'un jour sous un fuseau négatif. */
export function formatDayUtc(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
}
