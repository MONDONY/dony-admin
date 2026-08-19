import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminKycDetail } from '@/features/users/types/index'

/**
 * État de l'onglet KYC d'une fiche utilisateur.
 *
 * Chargement paresseux : `load()` n'est appelé qu'à l'ouverture de l'onglet, parce que la
 * lecture back déclenche un appel live à Stripe Identity — inutile de le payer pour tous
 * les administrateurs qui ouvrent une fiche sans regarder le KYC.
 */
export function useUserKyc() {
  const kyc = ref<AdminKycDetail | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)

  async function load(userId: string) {
    isLoading.value = true
    error.value = null
    try { kyc.value = await usersService.getKyc(userId) }
    catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger le KYC') }
    finally { isLoading.value = false }
  }

  async function reset(userId: string, reason: string) {
    error.value = null
    busy.value = true
    try { kyc.value = await usersService.resetKyc(userId, reason) }
    catch (e) { error.value = extractProblemMessage(e, 'Réinitialisation impossible') }
    finally { busy.value = false }
  }

  return { kyc, isLoading, error, busy, load, reset }
}
