import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'
import { DAC7_UNAVAILABLE, dac7CodeMessage, noteSensitiveMessage } from '@/features/dac7/types/index'

/**
 * Message d'un geste refusé (JSON classique, pas un Blob) : l'ancien back d'abord, puis nos
 * phrases pour les erreurs métier connues du back DAC7, puis le texte du serveur. `context`
 * précise le geste quand un même code a un sens différent (`deposit` : marquage « déposé »).
 */
export function gestureError(e: unknown, fallback: string, context?: 'deposit'): string {
  if (isEndpointMissing(e)) return DAC7_UNAVAILABLE
  const code = problemCode(e)
  // La note refusée : le back écrit lui-même la raison (UUID, IBAN, identifiant Stripe), on la garde si elle est en français.
  if (code === 'dac7-note-sensitive') return noteSensitiveMessage((e as { data?: { detail?: unknown } } | undefined)?.data?.detail)
  return dac7CodeMessage(code, context) ?? extractProblemMessage(e, fallback)
}
