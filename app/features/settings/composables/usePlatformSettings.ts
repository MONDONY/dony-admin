import { ref } from 'vue'
import { settingsService } from '@/features/settings/services/settingsService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { PlatformSetting } from '@/features/settings/types/index'

/**
 * État + actions des réglages plateforme : chargement de la liste, et mise à jour avec
 * substitution en place du réglage modifié — jamais de rechargement complet de la liste.
 * Même patron que `useAdminAnnouncements` (Lot B) et `useUserDetail` (Lot C).
 *
 * Volontairement uniforme sur les quatre clés (dont `sms_enabled`, qui conditionne
 * l'authentification par OTP) : ce composable ne traite aucune clé différemment des
 * autres — la double confirmation avant de couper `sms_enabled` est une responsabilité
 * de la page (T15), pas du composable.
 */
export function usePlatformSettings() {
  const settings = ref<PlatformSetting[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)
  /** Réglage et slug (`code` ProblemDetail) du dernier refus de mise à jour : le formulaire l'affiche sous la carte. */
  const errorKey = ref<string | null>(null)
  const errorCode = ref<string | null>(null)

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      settings.value = await settingsService.list()
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les paramètres')
    } finally {
      isLoading.value = false
    }
  }

  function replace(updated: PlatformSetting) {
    const idx = settings.value.findIndex((s) => s.key === updated.key)
    if (idx !== -1) settings.value[idx] = updated
  }

  /** Vrai si le back a accepté la valeur (la page s'en sert pour recharger ce qui en dépend). */
  async function update(key: string, value: string): Promise<boolean> {
    error.value = null
    errorKey.value = null
    errorCode.value = null
    busy.value = true
    try {
      replace(await settingsService.update(key, value))
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, 'Mise à jour impossible')
      errorKey.value = key
      const code = (e as { data?: { code?: unknown } } | undefined)?.data?.code
      errorCode.value = typeof code === 'string' ? code : null
      return false
    } finally {
      busy.value = false
    }
  }

  return { settings, isLoading, error, errorKey, errorCode, busy, load, update }
}
