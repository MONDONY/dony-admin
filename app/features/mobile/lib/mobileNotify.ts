import { isUuid } from '@/lib/safeInput'
import { extractProblemMessage } from '@/lib/problemDetail'

/** Le poste ordinateur n'impose pas de limite côté écran : le mobile en fixe une, prudente (message push court). */
export const NOTIFY_TITLE_MAX = 100
export const NOTIFY_BODY_MAX = 500

export interface NotifyDraft { userId: string; title: string; body: string }

/** Vrai si l'envoi est permis : un seul identifiant valide, titre et message non vides après trim, dans les limites. */
export function canSendNotification(d: NotifyDraft): boolean {
  const title = d.title.trim()
  const body = d.body.trim()
  return isUuid(d.userId)
    && title.length > 0 && title.length <= NOTIFY_TITLE_MAX
    && body.length > 0 && body.length <= NOTIFY_BODY_MAX
}

/** Message d'échec : 403/404/405 sans texte du back reçoivent une phrase claire, sinon le détail du back. */
export function notifyErrorMessage(e: unknown): string {
  const err = e as { statusCode?: number; status?: number; data?: { detail?: unknown } } | undefined
  const status = err?.statusCode ?? err?.status
  const detail = err?.data?.detail
  const hasDetail = typeof detail === 'string' && detail.trim().length > 0
  if (status === 403) return 'Vous n’avez pas le droit d’envoyer des notifications.'
  if (status === 405) return 'L’envoi n’est pas disponible sur ce serveur. Utilisez l’ordinateur.'
  if (status === 404 && !hasDetail) return 'Utilisateur introuvable ou envoi indisponible sur ce serveur.'
  return extractProblemMessage(e, 'Envoi impossible')
}
