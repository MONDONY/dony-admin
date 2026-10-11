import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { photoStorageService } from '@/features/photo-storage/services/photoStorageService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { PhotoStorageStatus } from '@/features/photo-storage/types/index'

/** Après un lancement : un rechargement toutes les 5 s tant qu'un passage tourne, 2 min au plus. */
const POLL_INTERVAL_MS = 5000
const POLL_MAX = 24
const NOTICE_STARTED = 'Passage lancé, actualisez dans un instant.'
const NOTICE_RUNNING = 'Une purge est déjà en cours, réessayez dans quelques minutes.'

/** Statut HTTP d'une erreur ofetch (`status`/`statusCode`, ou `response.status`). */
function httpStatus(e: unknown): number | undefined {
  const err = e as { status?: number; statusCode?: number; response?: { status?: number } } | undefined
  return err?.status ?? err?.statusCode ?? err?.response?.status
}

/**
 * État + actions de l'écran « Stockage photos » : statut de la purge, lancement manuel
 * d'une purge ou d'un rapprochement. Un 404 au chargement (back sans l'endpoint) rend
 * l'écran « indisponible » sans erreur ; un 409 signale qu'un passage est déjà en cours.
 * Un seul lancement à la fois (`launching`) : un double clic n'envoie qu'un POST.
 */
export function usePhotoStorage() {
  const status = ref<PhotoStorageStatus | null>(null)
  const unavailable = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)
  const launching = ref(false)

  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let polls = 0
  let disposed = false

  function stopPolling() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  function schedulePoll() {
    // Un rechargement en vol pendant un nouveau lancement ne doit pas créer une seconde boucle.
    stopPolling()
    pollTimer = setTimeout(async () => {
      pollTimer = null
      polls++
      await load()
      // `disposed` : un rechargement encore en vol au démontage ne doit pas relancer le suivi.
      if (!disposed && status.value?.running && polls < POLL_MAX) schedulePoll()
    }, POLL_INTERVAL_MS)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true
      stopPolling()
    })
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      status.value = await photoStorageService.status()
      unavailable.value = false
    } catch (e) {
      if (httpStatus(e) === 404) {
        unavailable.value = true
      } else {
        error.value = extractProblemMessage(e, 'Impossible de charger le stockage photos')
      }
    } finally {
      loading.value = false
    }
  }

  async function launch(call: () => Promise<{ started: boolean }>) {
    if (launching.value) return
    launching.value = true
    error.value = null
    notice.value = null
    try {
      await call()
      notice.value = NOTICE_STARTED
      stopPolling()
      polls = 0
      schedulePoll()
    } catch (e) {
      if (httpStatus(e) === 409) {
        notice.value = NOTICE_RUNNING
      } else {
        error.value = extractProblemMessage(e, 'Lancement impossible')
      }
    } finally {
      launching.value = false
    }
  }

  const runPurge = () => launch(() => photoStorageService.runPurge())
  const reconcile = (allowBulk: boolean) => launch(() => photoStorageService.reconcile(allowBulk))

  return { status, unavailable, loading, error, notice, launching, load, runPurge, reconcile }
}
