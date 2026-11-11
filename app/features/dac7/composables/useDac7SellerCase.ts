import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'
import { dac7Service } from '@/features/dac7/services/dac7Service'
import { DAC7_UNAVAILABLE, dac7CodeMessage } from '@/features/dac7/types/index'
import type { Dac7DiligenceEntry } from '@/features/dac7/types/index'

/** Message d'un geste refusé : l'ancien back d'abord, puis nos phrases pour les 409 métier, puis le serveur. */
function gestureError(e: unknown, fallback: string): string {
  if (isEndpointMissing(e)) return DAC7_UNAVAILABLE
  return dac7CodeMessage(problemCode(e)) ?? extractProblemMessage(e, fallback)
}

/**
 * Fiche d'un voyageur : registre des diligences, relance manuelle et décision de l'équipe.
 * Rien d'autre qu'un identifiant et une note libre ne passe ici : jamais de numéro fiscal.
 */
export function useDac7SellerCase() {
  const entries = ref<Dac7DiligenceEntry[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  const busy = ref(false)
  const actionError = ref<string | null>(null)
  const notice = ref<string | null>(null)

  // Jeton d'appel : la réponse du dernier chargement gagne (changement de voyageur, relecture).
  let current = 0
  let loadedUser: string | null = null

  async function loadDiligence(userId: string) {
    const mine = ++current
    if (loadedUser !== userId) entries.value = []
    loadedUser = userId
    isLoading.value = true
    error.value = null
    try {
      const rows = await dac7Service.diligence(userId)
      if (mine !== current) return
      entries.value = rows
      unavailable.value = false
    } catch (e) {
      if (mine !== current) return
      entries.value = []
      if (isEndpointMissing(e)) {
        unavailable.value = true
      } else {
        unavailable.value = false
        error.value = extractProblemMessage(e, 'Impossible de charger le registre des diligences')
      }
    } finally {
      if (mine === current) isLoading.value = false
    }
  }

  async function run(action: () => Promise<void>, done: string, fallback: string): Promise<boolean> {
    actionError.value = null
    notice.value = null
    busy.value = true
    try {
      await action()
      notice.value = done
      return true
    } catch (e) {
      actionError.value = gestureError(e, fallback)
      return false
    } finally {
      busy.value = false
    }
  }

  const remind = (userId: string) => run(
    () => dac7Service.remind(userId), 'Relance envoyée.', 'La relance n’a pas pu être envoyée',
  )
  const decide = (userId: string, note: string) => run(
    () => dac7Service.decision(userId, note), 'Décision enregistrée.', 'La décision n’a pas pu être enregistrée',
  )

  return { entries, isLoading, error, unavailable, busy, actionError, notice, loadDiligence, remind, decide }
}
