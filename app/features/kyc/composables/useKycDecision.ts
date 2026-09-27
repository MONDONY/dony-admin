import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import type { AdminKycDetail } from '@/features/users/types/index'

/** Repli français quand le ProblemDetail n'a pas de `detail`. */
const CODE_MESSAGES: Record<string, string> = {
  'kyc-already-verified': 'Cette identité est déjà validée : la fiche a été relue.',
  'kyc-not-verified': 'Cette identité n’est pas validée : il n’y a rien à révoquer. La fiche a été relue.',
  'kyc-no-provider-session': 'Aucune session chez le fournisseur : impossible de valider une identité dont les pièces n’ont pas été contrôlées.',
  'kyc-reject-code-invalid': 'Code de refus non reconnu par le serveur. Choisissez-en un autre.',
}
/** Conflits qui signifient « l'écran est en retard sur la base » : le parent relit la fiche. */
const STALE_CODES = new Set(['kyc-already-verified', 'kyc-not-verified'])

interface Options {
  /** Conflit « fiche en retard » : le parent relit la fiche. */
  onStale?: () => void
}

/**
 * Décisions manuelles sur l'identité d'un utilisateur (KYC_DECIDE) : valider, refuser,
 * révoquer. Chaque action rend la fiche KYC à jour, ou null en cas d'échec.
 * `unavailable` : ancien back sans les endpoints (404/405 sans code) ; les actions doivent
 * alors disparaître, sans erreur rouge.
 */
export function useKycDecision(userId: () => string | null, options: Options = {}) {
  const busy = ref(false)
  const error = ref<string | null>(null)
  const errorCode = ref<string | null>(null)
  const unavailable = ref(false)

  function clearError() {
    error.value = null
    errorCode.value = null
  }

  async function run(call: typeof usersService.getKyc): Promise<AdminKycDetail | null> {
    const id = userId()
    if (!id) return null
    clearError()
    busy.value = true
    try {
      return await call(id)
    } catch (e) {
      if (isEndpointMissing(e)) {
        unavailable.value = true
        return null
      }
      const code = problemCode(e)
      errorCode.value = code
      const hasDetail = typeof (e as { data?: { detail?: unknown } })?.data?.detail === 'string'
      error.value = !hasDetail && code && CODE_MESSAGES[code]
        ? CODE_MESSAGES[code]
        : extractProblemMessage(e, 'La décision n’a pas pu être enregistrée')
      if (code && STALE_CODES.has(code)) options.onStale?.()
      return null
    } finally {
      busy.value = false
    }
  }

  const approve = (reason: string) => run((id) => usersService.approveKyc(id, reason.trim()))
  const reject = (code: string, reason: string) => run((id) => usersService.rejectKyc(id, code, reason.trim()))
  const revoke = (code: string, reason: string) => run((id) => usersService.revokeKyc(id, code, reason.trim()))

  return { busy, error, errorCode, unavailable, clearError, approve, reject, revoke }
}
