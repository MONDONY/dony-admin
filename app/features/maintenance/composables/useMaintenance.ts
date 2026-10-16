import { ref } from 'vue'
import { maintenanceService } from '@/features/maintenance/services/maintenanceService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { MaintenanceState, MaintenanceUpdate } from '@/features/maintenance/types/index'

/** Statut HTTP d'une erreur ofetch (`status`/`statusCode`, ou `response.status`). */
function httpStatus(e: unknown): number | undefined {
  const err = e as { status?: number; statusCode?: number; response?: { status?: number } } | undefined
  return err?.status ?? err?.statusCode ?? err?.response?.status
}

/**
 * État + actions de la carte « Mode maintenance ». Chaque écriture renvoie l'état complet,
 * qui remplace l'état affiché. Un 404 au chargement (back sans l'endpoint) rend la carte
 * « indisponible » sans erreur. Une seule écriture à la fois (`busy`).
 */
export function useMaintenance() {
  const state = ref<MaintenanceState | null>(null)
  const unavailable = ref(false)
  const loading = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      state.value = await maintenanceService.get()
      unavailable.value = false
    } catch (e) {
      if (httpStatus(e) === 404) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible de charger le mode maintenance')
    } finally {
      loading.value = false
    }
  }

  async function write(action: () => Promise<MaintenanceState>, fallback: string): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    error.value = null
    try {
      state.value = await action()
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, fallback)
      return false
    } finally {
      busy.value = false
    }
  }

  const update = (body: MaintenanceUpdate) =>
    write(() => maintenanceService.update(body), 'Mise à jour du mode maintenance impossible')
  const addExemption = (userId: string, note: string | null) =>
    write(() => maintenanceService.addExemption(userId, note), 'Ajout du compte impossible')
  const removeExemption = (userId: string) =>
    write(() => maintenanceService.removeExemption(userId), 'Retrait du compte impossible')

  return { state, unavailable, loading, busy, error, load, update, addExemption, removeExemption }
}
