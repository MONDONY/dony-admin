import { computed, ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { problemCode } from '@/lib/endpointMissing'
import type { RecetteTesterStatus } from '@/features/users/types/index'

/**
 * Désignation d'un compte testeur du mode recette (yadony-back#449, FLUTTER-FA / FLUTTER-FB).
 *
 * Le GET ne dit pas à lui seul si l'environnement est en recette : `recetteModeActive` vaut
 * « mode ouvert ET compte testeur ». Un compte non testeur répond donc `false` en staging comme
 * en prod. On en déduit :
 * - testeur + mode actif → staging, interrupteur allumé ;
 * - testeur + mode inactif → mode fermé (prod) : section discrète, aucun geste ;
 * - non testeur → environnement inconnu : l'interrupteur est proposé, et un 409
 *   `recette-disabled` à l'écriture ferme la section pour le reste de la session.
 */
export type RecetteAvailability = 'loading' | 'hidden' | 'closed' | 'open'
export type RecetteFeedback = { tone: 'success' | 'error'; text: string }

/** Mode fermé constaté par un 409 : mémorisé pour ne pas reproposer le geste à chaque fiche. */
let modeKnownClosed = false
export function _resetRecetteModeMemo(): void { modeKnownClosed = false }

const FEEDBACK_MS = 4000

function httpStatus(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

function failureMessage(e: unknown): string {
  const status = httpStatus(e)
  const code = problemCode(e)
  if (status === 409 || code === 'recette-disabled') {
    return 'Mode recette fermé dans cet environnement : aucun compte ne peut y être désigné testeur.'
  }
  if (status === 404 || code === 'user-not-found') return 'Utilisateur introuvable.'
  if (status === 422) return 'Demande refusée par le serveur (requête invalide).'
  return extractProblemMessage(e, 'Modification impossible, réessayez.')
}

export function useRecetteTester(userId: string) {
  const status = ref<RecetteTesterStatus | null>(null)
  const loading = ref(true)
  const loadFailed = ref(false)
  const closed = ref(modeKnownClosed)
  const busy = ref(false)
  const feedback = ref<RecetteFeedback | null>(null)
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null

  const availability = computed<RecetteAvailability>(() => {
    if (loading.value) return 'loading'
    if (loadFailed.value || !status.value) return 'hidden'
    if (status.value.recetteTester && status.value.recetteModeActive) return 'open'
    if (closed.value || status.value.recetteTester) return 'closed'
    return 'open'
  })

  function showFeedback(next: RecetteFeedback) {
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedback.value = next
    feedbackTimer = setTimeout(() => { feedback.value = null; feedbackTimer = null }, FEEDBACK_MS)
  }

  async function load() {
    loading.value = true
    loadFailed.value = false
    try {
      status.value = await usersService.getRecetteTester(userId)
    } catch {
      // Back sans l'endpoint, droit retiré, compte introuvable : la section se tait, la fiche
      // reste utilisable. Ce réglage de recette ne mérite pas une erreur en tête de fiche.
      status.value = null
      loadFailed.value = true
    } finally {
      loading.value = false
    }
  }

  /** Bascule optimiste : l'état affiché change tout de suite et revient en cas d'échec. */
  async function setEnabled(enabled: boolean): Promise<boolean> {
    if (busy.value || !status.value) return false
    const previous = status.value
    status.value = { ...previous, recetteTester: enabled, recetteModeActive: enabled }
    busy.value = true
    try {
      status.value = await usersService.setRecetteTester(userId, enabled)
      showFeedback({ tone: 'success', text: enabled ? 'Compte testeur activé.' : 'Compte testeur désactivé.' })
      return true
    } catch (e) {
      status.value = previous
      if (httpStatus(e) === 409 || problemCode(e) === 'recette-disabled') {
        modeKnownClosed = true
        closed.value = true
      }
      showFeedback({ tone: 'error', text: failureMessage(e) })
      return false
    } finally {
      busy.value = false
    }
  }

  function dispose() {
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedbackTimer = null
  }

  return { status, loading, busy, feedback, availability, load, setEnabled, dispose }
}
