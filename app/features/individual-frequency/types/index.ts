/**
 * Alerte « particulier à confirmer » : un voyageur déclaré Particulier dont le nombre de trajets
 * avec colis sur 30 jours dépasse le seuil de la plateforme (réglage `individual_trips_alert_threshold`).
 * C'est un signal pour l'équipe, jamais un blocage ni un changement de statut automatique.
 *
 * Contrat : `GET /admin/individual-frequency-flags`, `POST .../{flagId}/dismiss` et le champ
 * `individualFrequencyAlert` de la fiche utilisateur, mêmes droits que la revue GP Pro. Le back
 * sérialise en NON_NULL : un champ nul est absent du JSON, et un ancien back n'envoie rien du tout,
 * d'où des champs tous optionnels.
 */

/** Une ligne de la file « Particuliers à confirmer ». */
export interface IndividualFrequencyFlagRow {
  flagId: string
  userId: string
  displayName?: string | null
  tripsCount?: number
  windowDays?: number
  threshold?: number
  detectedAt?: string | null
  /** Vrai : le voyageur a demandé GP Pro avec la fréquence « chaque semaine ». Absent = faux. */
  weeklyApplication?: boolean
}

/** Alerte ouverte d'un utilisateur, portée par sa fiche (`individualFrequencyAlert`). */
export interface IndividualFrequencyAlert {
  flagId: string
  tripsCount?: number
  windowDays?: number
  threshold?: number
  detectedAt?: string | null
  /** Vrai : le voyageur a demandé GP Pro avec la fréquence « chaque semaine ». Absent = faux. */
  weeklyApplication?: boolean
}

export const INDIVIDUAL_FREQUENCY_DEFAULT_WINDOW_DAYS = 30

export const INDIVIDUAL_FREQUENCY_UNAVAILABLE = 'Particuliers à confirmer indisponible tant que le serveur n’est pas mis à jour.'

export const WEEKLY_APPLICATION_TEXT = 'A demandé GP Pro, fréquence : chaque semaine.'

/**
 * « 5 trajets avec colis sur 30 jours (seuil : 4). Statut déclaré : Particulier. »
 * Avec `weeklyApplication`, le nombre de trajets peut être sous le seuil : la phrase des trajets
 * n'est alors gardée que s'il le dépasse, et « A demandé GP Pro, fréquence : chaque semaine. »
 * s'y ajoute (ou la remplace).
 */
export function frequencySummary(
  a: Pick<IndividualFrequencyAlert, 'tripsCount' | 'windowDays' | 'threshold' | 'weeklyApplication'>,
): string {
  const days = a.windowDays ?? INDIVIDUAL_FREQUENCY_DEFAULT_WINDOW_DAYS
  const overThreshold = typeof a.tripsCount === 'number' && typeof a.threshold === 'number' && a.tripsCount > a.threshold
  const parts: string[] = []
  if (!a.weeklyApplication || overThreshold) {
    const head = typeof a.tripsCount === 'number'
      ? `${a.tripsCount} trajet${a.tripsCount > 1 ? 's' : ''} avec colis`
      : 'Trajets avec colis'
    const threshold = typeof a.threshold === 'number' ? ` (seuil : ${a.threshold})` : ''
    parts.push(`${head} sur ${days} jours${threshold}.`)
  }
  if (a.weeklyApplication) parts.push(WEEKLY_APPLICATION_TEXT)
  parts.push('Statut déclaré : Particulier.')
  return parts.join(' ')
}
