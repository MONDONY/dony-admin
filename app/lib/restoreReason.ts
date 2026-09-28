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
 * 422 de validation standard du back (bean validation) : un tableau `violations` et AUCUN
 * `code` métier. Rend le message à afficher dans le dialogue (celui de la première violation,
 * sinon un texte générique), ou null s'il s'agit d'une autre erreur.
 */
export function reasonViolationMessage(e: unknown): string | null {
  const err = e as { statusCode?: number; status?: number; data?: { code?: unknown; violations?: unknown } } | undefined
  const status = err?.statusCode ?? err?.status
  if (status !== 422 || err?.data?.code || !Array.isArray(err?.data?.violations)) return null
  const first = (err.data.violations as unknown[])[0]
  const message = typeof first === 'string' ? first : (first as { message?: unknown } | undefined)?.message
  return typeof message === 'string' && message.trim() ? message.trim() : GENERIC_REASON_REFUSAL
}
