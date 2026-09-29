import { ref } from 'vue'
import { supportService } from '@/features/support/services/supportService'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminSupportTicket, StartSupportTicketPayload } from '@/features/support/types/index'

/** Champs dont la fenêtre affiche l'erreur à côté de la saisie. */
const SHOWN_FIELDS = ['userId', 'category', 'subject', 'message', 'attachmentKeys']

export const START_UNAVAILABLE_MESSAGE = 'Cette fonction n’est pas encore disponible sur le serveur.'

function httpStatus(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

/** `detail` du ProblemDetail, sans retomber sur le message technique (« 404 Not Found »). */
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
 * Envoi d'une conversation ouverte par l'admin (POST /admin/support/tickets). Les erreurs
 * restent dans la fenêtre : message général, erreurs par champ (422) et indisponibilité
 * quand le back n'a pas encore l'endpoint (règle des PR jumelles).
 */
export function useStartSupportConversation() {
  const sending = ref(false)
  const error = ref<string | null>(null)
  const fieldErrors = ref<Record<string, string>>({})
  const unavailable = ref(false)

  function reset() {
    error.value = null
    fieldErrors.value = {}
    unavailable.value = false
  }

  async function submit(payload: StartSupportTicketPayload): Promise<AdminSupportTicket | null> {
    sending.value = true
    reset()
    try {
      return await supportService.startTicket(payload)
    } catch (e) {
      const status = httpStatus(e)
      if (isEndpointMissing(e)) {
        unavailable.value = true
        error.value = START_UNAVAILABLE_MESSAGE
      } else if (problemCode(e) === 'user-not-found') {
        error.value = problemDetailOr(e, 'Ce compte est introuvable : il a peut-être été supprimé.')
      } else if (status === 403) {
        error.value = 'Vous n’avez pas la permission d’écrire aux utilisateurs.'
      } else if (status === 422 && Object.keys(violationsByField(e)).length > 0) {
        const byField = violationsByField(e)
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
