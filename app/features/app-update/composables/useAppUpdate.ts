import { ref } from 'vue'
import { appUpdateService } from '@/features/app-update/services/appUpdateService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AppUpdateState } from '@/features/app-update/types/index'

/** Statut HTTP d'une erreur ofetch (`status`/`statusCode`, ou `response.status`). */
function httpStatus(e: unknown): number | undefined {
  const err = e as { status?: number; statusCode?: number; response?: { status?: number } } | undefined
  return err?.status ?? err?.statusCode ?? err?.response?.status
}

/** Messages français par statut ; les autres cas retombent sur le `detail` du back puis sur le repli. */
const WRITE_MESSAGES: Record<number, string> = {
  409: 'La configuration a changé entre-temps, réessaie.',
  422: 'Valeur invalide : saisis un nombre entier entre 0 et 100000.',
  503: 'Firebase est injoignable, ou le droit de publier la configuration manque. Réessaie plus tard.',
  403: 'Tu n’as pas le droit de modifier cette configuration.',
}

export const BUILD_MIN = 0
export const BUILD_MAX = 100000

/**
 * État + actions de la page « Mise à jour de l'app ». Chaque écriture renvoie l'état complet,
 * qui remplace l'état affiché. Un 404 au chargement (back sans l'endpoint) rend la carte
 * « indisponible » sans erreur. Une seule écriture à la fois (`busy`).
 */
export function useAppUpdate() {
  const state = ref<AppUpdateState | null>(null)
  const unavailable = ref(false)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)
  /** Vrai quand le chargement a échoué (hors 404) : la carte propose de réessayer. */
  const loadFailed = ref(false)

  async function load() {
    loading.value = true
    error.value = null
    loadFailed.value = false
    try {
      state.value = await appUpdateService.get()
      unavailable.value = false
    } catch (e) {
      const status = httpStatus(e)
      if (status === 404) unavailable.value = true
      else {
        loadFailed.value = true
        error.value = status === 403
          ? WRITE_MESSAGES[403]!
          : extractProblemMessage(e, 'Impossible de charger la configuration de mise à jour')
      }
    } finally {
      loading.value = false
    }
  }

  async function save(recommendedBuild: number): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    error.value = null
    try {
      state.value = await appUpdateService.update({ recommendedBuild })
      return true
    } catch (e) {
      const status = httpStatus(e)
      error.value = (status !== undefined ? WRITE_MESSAGES[status] : undefined)
        ?? extractProblemMessage(e, 'Enregistrement impossible, réessaie.')
      return false
    } finally {
      busy.value = false
    }
  }

  return { state, unavailable, loading, busy, error, loadFailed, load, save }
}
