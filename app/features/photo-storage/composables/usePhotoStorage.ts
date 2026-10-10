import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { photoStorageService } from '@/features/photo-storage/services/photoStorageService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { PhotoStorageStatus } from '@/features/photo-storage/types/index'

const RELOAD_DELAY_MS = 3000
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
 */
export function usePhotoStorage() {
  const status = ref<PhotoStorageStatus | null>(null)
  const unavailable = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)

  let reloadTimer: ReturnType<typeof setTimeout> | null = null

  function clearReload() {
    if (reloadTimer !== null) {
      clearTimeout(reloadTimer)
      reloadTimer = null
    }
  }

  if (getCurrentScope()) onScopeDispose(clearReload)

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
    error.value = null
    notice.value = null
    try {
      await call()
      notice.value = NOTICE_STARTED
      clearReload()
      reloadTimer = setTimeout(() => {
        reloadTimer = null
        void load()
      }, RELOAD_DELAY_MS)
    } catch (e) {
      if (httpStatus(e) === 409) {
        notice.value = NOTICE_RUNNING
      } else {
        error.value = extractProblemMessage(e, 'Lancement impossible')
      }
    }
  }

  const runPurge = () => launch(() => photoStorageService.runPurge())
  const reconcile = (allowBulk: boolean) => launch(() => photoStorageService.reconcile(allowBulk))

  return { status, unavailable, loading, error, notice, load, runPurge, reconcile }
}
