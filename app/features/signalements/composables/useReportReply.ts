import { ref } from 'vue'
import { reportsService } from '@/features/signalements/services/reportsService'
import type { ReportReplyPayload, ReportReplyResponse } from '@/features/signalements/types/index'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'
import { REPORT_REPLY_MAX } from '@/features/signalements/reportReply'

/** Champs dont la fenêtre affiche l'erreur à côté de la saisie. */
const SHOWN_FIELDS = ['message', 'attachmentKeys']

export const REPLY_UNAVAILABLE_MESSAGE = 'Cette fonction n’est pas encore disponible sur le serveur.'

function httpStatus(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

/** `detail` du ProblemDetail, sans retomber sur le message technique d'ofetch. */
function problemDetailOr(e: unknown, fallback: string): string {
  const detail = (e as { data?: { detail?: unknown } } | undefined)?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail : fallback
}

/** 422 de bean validation : objet `champ → message`, seules les valeurs texte sont retenues. */
function violationsByField(e: unknown): Record<string, string> {
  const v = (e as { data?: { violations?: unknown } } | undefined)?.data?.violations
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [field, message] of Object.entries(v as Record<string, unknown>)) {
    if (typeof message === 'string' && message.trim()) out[field] = message.trim()
  }
  return out
}

/**
 * Réponse au signalant d'un rapport de bug (POST /admin/reports/{id}/reply). Les erreurs
 * restent dans la fenêtre : message général, erreurs par champ (422) et indisponibilité
 * quand le back n'a pas encore l'endpoint (règle des PR jumelles).
 */
export function useReportReply() {
  const sending = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})
  const unavailable = ref(false)

  function reset() {
    error.value = null
    fieldErrors.value = {}
    unavailable.value = false
  }

  async function submit(reportId: string, payload: ReportReplyPayload): Promise<ReportReplyResponse | null> {
    sending.value = true
    reset()
    try {
      return await reportsService.reply(reportId, payload)
    } catch (e) {
      const status = httpStatus(e)
      const code = problemCode(e)
      const byField = status === 422 ? violationsByField(e) : {}
      if (isEndpointMissing(e)) {
        unavailable.value = true
        error.value = REPLY_UNAVAILABLE_MESSAGE
      } else if (code === 'report-not-app-bug') {
        error.value = 'Seuls les rapports de bug de l’application permettent de répondre au signalant.'
      } else if (code === 'reporter-unavailable') {
        error.value = problemDetailOr(e, 'Le compte du signalant n’est plus joignable : impossible de lui répondre.')
      } else if (code === 'support-invalid-field' && Object.keys(byField).length === 0) {
        fieldErrors.value = { message: problemDetailOr(e, `Le message doit faire entre 1 et ${REPORT_REPLY_MAX} caractères.`) }
        error.value = 'Corrigez les champs signalés.'
      } else if (code === 'support-attachment-not-owned' || code === 'support-too-many-attachments') {
        const fallback = code === 'support-too-many-attachments'
          ? 'Quatre images au plus par réponse.'
          : 'Une image jointe est invalide : retirez-la puis joignez-la de nouveau.'
        fieldErrors.value = { attachmentKeys: problemDetailOr(e, fallback) }
        error.value = 'Corrigez les champs signalés.'
      } else if (status === 403) {
        error.value = 'Vous n’avez pas la permission de répondre aux signalants.'
      } else if (status === 404) {
        error.value = problemDetailOr(e, 'Ce signalement est introuvable : il a peut-être été supprimé.')
      } else if (Object.keys(byField).length > 0) {
        fieldErrors.value = byField
        // Un champ que la fenêtre n'affiche pas garde son message dans l'erreur générale.
        const orphans = Object.entries(byField).filter(([f]) => !SHOWN_FIELDS.includes(f)).map(([, m]) => m)
        error.value = orphans.length ? orphans.join(' ') : 'Corrigez les champs signalés.'
      } else {
        error.value = extractProblemMessage(e, 'L’envoi a échoué. Réessayez.')
      }
      return null
    } finally {
      sending.value = false
    }
  }

  return { sending, error, fieldErrors, unavailable, submit, reset }
}
