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
  /**
   * Dernière lecture ou écriture lancée : une réponse plus ancienne (clics rapides d'un dossier à
   * l'autre) est écartée. Sans cela, le dossier d'un utilisateur pourrait s'afficher, et se
   * décider, sous un autre.
   */
  let calls = 0

  async function load(userId: string) {
    const mine = ++calls
    isLoading.value = true
    error.value = null
    // Vidé AVANT l'appel, et de nouveau en cas d'échec : ce composable vit au niveau de la
    // page, son état survit donc à la fermeture d'une fiche. Sans ce nettoyage, l'onglet KYC
    // d'un utilisateur dont le chargement échoue afficherait le dossier — pièces, motif de
    // rejet, session Stripe — de l'utilisateur consulté juste avant, sous son nom à lui.
    kyc.value = null
    try {
      const res = await usersService.getKyc(userId)
      if (mine === calls) kyc.value = res
    } catch (e) {
      if (mine === calls) {
        kyc.value = null
        error.value = extractProblemMessage(e, 'Impossible de charger le KYC')
      }
    } finally {
      if (mine === calls) isLoading.value = false
    }
  }

  async function reset(userId: string, reason: string) {
    const mine = ++calls
    error.value = null
    busy.value = true
    try {
      const res = await usersService.resetKyc(userId, reason)
      if (mine === calls) kyc.value = res
    } catch (e) {
      if (mine === calls) error.value = extractProblemMessage(e, 'Réinitialisation impossible')
    } finally {
      busy.value = false
    }
  }

  /**
   * Relecture silencieuse après un conflit (fiche en retard sur la base) : la fiche reste
   * affichée pendant l'appel, et un échec la laisse telle quelle. `load()` la viderait, ce
   * qui démonterait le dialogue de décision et son message d'erreur.
   */
  async function refresh(userId: string) {
    const mine = ++calls
    try {
      const res = await usersService.getKyc(userId)
      if (mine === calls) kyc.value = res
    } catch { /* la fiche affichée reste la dernière connue */ }
  }

  /** Remplace la fiche par celle renvoyée par une décision admin. */
  function set(next: AdminKycDetail) {
    calls++
    kyc.value = next
    error.value = null
  }

  return { kyc, isLoading, error, busy, load, refresh, set, reset }
}
