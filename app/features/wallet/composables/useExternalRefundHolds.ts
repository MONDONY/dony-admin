import { computed, ref } from 'vue'
import { walletService } from '@/features/wallet/services/walletService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isWalletEndpointMissing } from '@/features/wallet/types/index'
import type { AdminExternalRefundHold } from '@/features/wallet/types/index'

/**
 * Gels d'un utilisateur après une recharge remboursée hors de l'app. Un back antérieur sans
 * l'endpoint renvoie 404 : la section reste simplement absente.
 */
export function useExternalRefundHolds(userId: string) {
  const holds = ref<AdminExternalRefundHold[]>([])
  const error = ref<string | null>(null)
  const success = ref<string | null>(null)
  const busyId = ref<string | null>(null)

  const openHolds = computed(() => holds.value.filter(h => h.status === 'OPEN'))

  async function load(keepMessages = false) {
    if (!keepMessages) error.value = null
    try {
      const result = await walletService.listExternalRefundHolds(userId)
      // Toute autre forme (page, objet d'erreur d'un proxy) vaut « aucun gel » : jamais d'écran cassé.
      holds.value = Array.isArray(result) ? result : []
    } catch (e) {
      holds.value = []
      if (!isWalletEndpointMissing(e)) error.value = extractProblemMessage(e, 'Impossible de charger les gels du portefeuille')
    }
  }

  /** Lève un gel ; la liste est relue ensuite, réussite ou refus (409 si un autre admin l'a levé). */
  async function release(holdId: string, note: string): Promise<boolean> {
    busyId.value = holdId
    error.value = null
    success.value = null
    try {
      await walletService.releaseExternalRefundHold(userId, holdId, note)
      success.value = 'Gel levé : la devise peut de nouveau être utilisée.'
      return true
    } catch (e) {
      error.value = extractProblemMessage(e, 'La levée du gel a échoué')
      return false
    } finally {
      busyId.value = null
      await load(true)
    }
  }

  return { holds, openHolds, error, success, busyId, load, release }
}
