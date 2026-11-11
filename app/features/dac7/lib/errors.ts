import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'
import { DAC7_UNAVAILABLE, dac7CodeMessage } from '@/features/dac7/types/index'

/**
 * Message d'un geste refusé (JSON classique, pas un Blob) : l'ancien back d'abord, puis nos
 * phrases pour les erreurs métier connues du back DAC7, puis le texte du serveur.
 */
export function gestureError(e: unknown, fallback: string): string {
  if (isEndpointMissing(e)) return DAC7_UNAVAILABLE
  return dac7CodeMessage(problemCode(e)) ?? extractProblemMessage(e, fallback)
}
