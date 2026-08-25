/**
 * Étiquette d'identification d'un compte dans le tableau.
 *
 * L'email vient de Firebase et disparaît définitivement à l'anonymisation ; une inscription
 * par téléphone n'en a jamais eu. Une case vide laisserait deux homonymes indiscernables sur
 * l'écran depuis lequel on décide de suspendre ou de supprimer — d'où le repli sur l'identifiant,
 * toujours présent.
 */
export function userIdentityLabel(
  u: { email: string | null; id: string },
): { text: string; isFallback: boolean } {
  const email = u.email?.trim()
  if (email) return { text: email, isFallback: false }
  return { text: u.id.slice(0, 8), isFallback: true }
}
