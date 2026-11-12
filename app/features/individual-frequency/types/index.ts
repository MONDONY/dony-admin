/**
 * Alerte « particulier à confirmer » : un voyageur déclaré Particulier dont le nombre de trajets
 * publiés dans le mois civil dépasse le seuil de la plateforme (réglage `individual_trips_alert_threshold`,
 * strictement supérieur).
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
  /** Libellé de période renvoyé par le back (ex. « en novembre »). Absent : « ce mois-ci ». */
  periodLabel?: string | null
  threshold?: number
  detectedAt?: string | null
  /** Vrai : le voyageur a demandé GP Pro avec la fréquence « chaque semaine ». Absent = faux. */
  weeklyApplication?: boolean
}

/** Alerte ouverte d'un utilisateur, portée par sa fiche (`individualFrequencyAlert`). */
export interface IndividualFrequencyAlert {
  flagId: string
  tripsCount?: number
  /** Libellé de période renvoyé par le back (ex. « en novembre »). Absent : « ce mois-ci ». */
  periodLabel?: string | null
  threshold?: number
  detectedAt?: string | null
  /** Vrai : le voyageur a demandé GP Pro avec la fréquence « chaque semaine ». Absent = faux. */
  weeklyApplication?: boolean
}

export const INDIVIDUAL_FREQUENCY_DEFAULT_PERIOD_LABEL = 'ce mois-ci'

export const INDIVIDUAL_FREQUENCY_UNAVAILABLE = 'Particuliers à confirmer indisponible tant que le serveur n’est pas mis à jour.'

export const WEEKLY_APPLICATION_TEXT = 'A demandé GP Pro, fréquence : chaque semaine.'

/**
 * « 5 trajets publiés ce mois-ci (seuil : 4). Statut déclaré : Particulier. »
 * Avec `weeklyApplication`, le nombre de trajets peut être sous le seuil : la phrase des trajets
 * n'est alors gardée que s'il le dépasse, et « A demandé GP Pro, fréquence : chaque semaine. »
 * s'y ajoute (ou la remplace).
 */
export function frequencySummary(
  a: Pick<IndividualFrequencyAlert, 'tripsCount' | 'periodLabel' | 'threshold' | 'weeklyApplication'>,
): string {
  const period = a.periodLabel?.trim() || INDIVIDUAL_FREQUENCY_DEFAULT_PERIOD_LABEL
  const overThreshold = typeof a.tripsCount === 'number' && typeof a.threshold === 'number' && a.tripsCount > a.threshold
  const parts: string[] = []
  if (!a.weeklyApplication || overThreshold) {
    const head = typeof a.tripsCount === 'number'
      ? `${a.tripsCount} trajet${a.tripsCount > 1 ? 's' : ''} publié${a.tripsCount > 1 ? 's' : ''}`
      : 'Trajets publiés'
    const threshold = typeof a.threshold === 'number' ? ` (seuil : ${a.threshold})` : ''
    parts.push(`${head} ${period}${threshold}.`)
  }
  if (a.weeklyApplication) parts.push(WEEKLY_APPLICATION_TEXT)
  parts.push('Statut déclaré : Particulier.')
  return parts.join(' ')
}
