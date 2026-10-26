import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { AdminNoShow, NoShowDecision, NoShowDecisionResult } from '@/features/incidents/types/index'
import { decisionSuccess, disputePending } from '@/features/incidents/components/noShowLabels'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'

const ALREADY_DECIDED = 'noshow-already-decided'
const NOT_FOUND = 'noshow-not-found'
/** Le litige d'une absence confirmée à l'arrivée est créé après la réponse : on relit un peu plus tard. */
export const DISPUTE_REFRESH_MS = 1000

function httpStatus(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

/** Messages de validation du back : objet `champ → message` (contrat) ou liste `{ message }`. */
function violationsMessage(e: unknown): string | null {
  const v = (e as { data?: { violations?: unknown } } | undefined)?.data?.violations
  if (!v || typeof v !== 'object') return null
  const messages = Array.isArray(v)
    ? v.map((x) => (x as { message?: unknown })?.message)
    : Object.values(v as Record<string, unknown>)
  const texts = messages.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
  return texts.length ? texts.join(' ') : null
}

function decisionErrorMessage(e: unknown): string {
  if (problemCode(e) === ALREADY_DECIDED) return 'Cette déclaration a déjà été tranchée par un autre administrateur. La liste a été rechargée.'
  if (problemCode(e) === NOT_FOUND) return 'Cette déclaration n’existe plus. La liste a été rechargée.'
  const status = httpStatus(e)
  if (status === 422) return violationsMessage(e) ?? extractProblemMessage(e, 'Le motif est invalide.')
  if (isEndpointMissing(e)) return 'Action indisponible : le serveur n’est pas encore à jour.'
  if (status === 403) return 'Vous n’avez pas la permission de trancher ce no-show.'
  return extractProblemMessage(e, 'La décision n’a pas pu être enregistrée.')
}

/**
 * Décision sur une déclaration d'absence (confirmer ou rejeter). `reload` relit la file après chaque
 * décision ou conflit ; l'ancien back ne sait que confirmer, sans motif.
 */
export function useNoShowDecision(reload: () => Promise<void>) {
  async function decide(row: AdminNoShow, decision: NoShowDecision, reason: string): Promise<NoShowDecisionResult> {
    if (row.legacy && decision === 'reject') {
      return { ok: false, code: null, message: 'Le rejet n’est pas disponible tant que le serveur n’est pas à jour.' }
    }
    try {
      if (row.legacy) {
        await incidentsService.confirmLegacyNoShow(row.bidId)
        await reload()
        return { ok: true, message: decisionSuccess(row, decision) }
      }
      const motif = reason.trim()
      const updated = decision === 'confirm'
        ? await incidentsService.confirmNoShow(row.id, motif)
        : await incidentsService.rejectNoShow(row.id, motif)
      await reload()
      if (disputePending(updated)) {
        // Le litige apparaît juste après la réponse : une seconde lecture le fait entrer dans la file.
        setTimeout(() => { void reload() }, DISPUTE_REFRESH_MS)
        return { ok: true, message: decisionSuccess(row, decision, true), disputePending: true }
      }
      return { ok: true, message: decisionSuccess(row, decision) }
    } catch (e) {
      const code = problemCode(e)
      if (code === ALREADY_DECIDED || code === NOT_FOUND) await reload()
      return { ok: false, code, message: decisionErrorMessage(e) }
    }
  }
  return { decide }
}
