/**
 * Le back envoie des LocalDateTime UTC sans fuseau : on ajoute Z avant de convertir.
 * `timeZone` est optionnel (fuseau de la machine par défaut) ; il rend le rendu déterministe en test.
 */
export function formatUtc(iso: string | null, timeZone?: string): string {
  if (!iso) return '—'
  const d = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone })
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} Ko`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`
  return `${(n / 1024 ** 3).toFixed(2)} Go`
}
