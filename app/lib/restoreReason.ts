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
