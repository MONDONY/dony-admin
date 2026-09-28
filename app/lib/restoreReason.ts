/**
 * Motif d'une restauration (avis, signalement, message) ou d'une annulation de suppression de
 * compte : le back exige 10 à 500 caractères et le journalise avec l'administrateur.
 */
export const RESTORE_REASON_MIN = 10
export const RESTORE_REASON_MAX = 500

export function restoreReasonValid(reason: string): boolean {
  const n = reason.trim().length
  return n >= RESTORE_REASON_MIN && n <= RESTORE_REASON_MAX
}

const GENERIC_REASON_REFUSAL = `Motif refusé : il doit compter entre ${RESTORE_REASON_MIN} et ${RESTORE_REASON_MAX} caractères.`

/**
 * 422 de validation standard du back (bean validation) : `violations` et AUCUN `code` métier.
 * Le GlobalExceptionHandler envoie un OBJET `{ "<champ>": "<message>" }` (dernier segment du
 * chemin) : on lit `reason`, sinon la première valeur, sinon un texte générique. Un tableau
 * (objets `{ message }` ou chaînes) reste toléré. Null s'il s'agit d'une autre erreur.
 */
export function reasonViolationMessage(e: unknown): string | null {
  const err = e as { statusCode?: number; status?: number; data?: { code?: unknown; violations?: unknown } } | undefined
  const status = err?.statusCode ?? err?.status
  const violations = err?.data?.violations
  if (status !== 422 || err?.data?.code || violations === null || typeof violations !== 'object') return null
  let message: unknown
  if (Array.isArray(violations)) {
    const first = violations[0]
    message = typeof first === 'string' ? first : (first as { message?: unknown } | undefined)?.message
  } else {
    const byField = violations as Record<string, unknown>
    message = 'reason' in byField ? byField.reason : Object.values(byField)[0]
  }
  return typeof message === 'string' && message.trim() ? message.trim() : GENERIC_REASON_REFUSAL
}
