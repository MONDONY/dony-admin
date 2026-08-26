import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminDeletionReasonCode, DeletionImpact } from '@/features/users/types/index'

/**
 * État de l'écran de suppression : le rapport d'impact, puis l'exécution.
 *
 * Sur le modèle de useUserDetail — même découpage isLoading / busy, mêmes erreurs RFC 7807.
 */
export function useUserDeletion() {
  const impact = ref<DeletionImpact | null>(null)
  const isLoading = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)

  // Jeton incrémental : chaque appel à loadImpact incrémente ce compteur et mémorise
  // la valeur courante. Si une réponse arrive après qu'un appel plus récent a été lancé,
  // son résultat est ignoré — il correspond à un compte différent.
  let requestSeq = 0

  async function loadImpact(id: string) {
    const seq = ++requestSeq
    isLoading.value = true
    error.value = null
    // Vidé avant l'appel : garder le rapport du compte précédent le ferait passer pour
    // celui du compte affiché le temps du chargement, ou définitivement si l'appel échoue.
    impact.value = null
    try {
      const result = await usersService.getDeletionImpact(id)
      // Réponse obsolète : un appel plus récent a déjà été lancé — on abandonne.
      if (seq !== requestSeq) return
      impact.value = result
    }
    catch (e) {
      if (seq !== requestSeq) return
      error.value = extractProblemMessage(e, 'Impossible de charger l\'analyse d\'impact')
    }
    finally {
      // Réinitialise isLoading seulement pour la requête la plus récente.
      if (seq === requestSeq) isLoading.value = false
    }
  }

  /** Rend true si la suppression a abouti — l'appelant s'en sert pour fermer l'écran. */
  async function remove(
    id: string,
    reasonCode: AdminDeletionReasonCode,
    reason: string,
  ): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      await usersService.deleteUser(id, reasonCode, reason)
      return true
    }
    catch (e) {
      error.value = extractProblemMessage(e, 'Suppression échouée')
      return false
    }
    finally {
      busy.value = false
    }
  }

  function reset() {
    impact.value = null
    error.value = null
  }

  return { impact, isLoading, busy, error, loadImpact, remove, reset }
}
