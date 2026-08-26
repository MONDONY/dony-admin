/**
 * Phrase de contrôle exigée avant une suppression de compte — geste irréversible.
 * Sert aussi bien à l'exécution RGPD qu'à la suppression décidée par l'administrateur.
 *
 * ⚠️ Ne doit **jamais** retourner une chaîne vide. `ConfirmActionDialog` traite une phrase
 * vide comme « pas de double confirmation » : plus d'input de contrôle, et `canConfirm` ne
 * vérifie plus rien. Un compte sans prénom ni nom — cas normal pour une inscription par
 * téléphone jamais passée par le KYC, et les deux champs sont `string | null` — perdrait
 * donc silencieusement sa protection sur l'action la plus destructrice du back-office.
 *
 * D'où la cascade jusqu'à `id`, toujours présent.
 */
export function deletionConfirmationPhrase(request: { firstName: string | null; lastName: string | null; email: string | null; id: string }): string {
  const name = [request.firstName, request.lastName].filter(Boolean).join(' ').trim()
  if (name) return name
  if (request.email) return request.email
  return request.id
}
