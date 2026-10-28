import { ref } from 'vue'
import { walletService } from '@/features/wallet/services/walletService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminWalletAdjustmentRequest } from '@/features/wallet/types/index'

const PAGE_SIZE = 20

/**
 * File des corrections de solde en attente d'un second admin. Approuver écrit le mouvement au
 * nom de son auteur ; rejeter n'écrit rien. Le back refuse qu'un admin approuve sa propre
 * demande (403) et qu'une demande soit décidée deux fois (409) : la file est rechargée après
 * chaque décision, réussie ou non, pour montrer l'état réel.
 */
export function useAdjustmentApprovals() {
  const requests = ref<AdminWalletAdjustmentRequest[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const success = ref<string | null>(null)
  const busyId = ref<string | null>(null)
  const currentPage = ref(0)
  const totalPages = ref(0)

  /** @param keepMessages vrai après une décision : son message (succès ou refus) reste affiché. */
  async function load(page = currentPage.value, keepMessages = false) {
    isLoading.value = true
    if (!keepMessages) error.value = null
    try {
      const result = await walletService.listAdjustmentRequests('PENDING', page, PAGE_SIZE)
      requests.value = result.content
      currentPage.value = result.number
      totalPages.value = result.totalPages
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les corrections à approuver')
    } finally {
      isLoading.value = false
    }
  }

  async function decide(id: string, action: () => Promise<unknown>, done: string, failed: string) {
    busyId.value = id
    error.value = null
    success.value = null
    try {
      await action()
      success.value = done
    } catch (e) {
      error.value = extractProblemMessage(e, failed)
    } finally {
      busyId.value = null
      await load(currentPage.value, true)
    }
  }

  function approve(id: string) {
    return decide(id, () => walletService.approveAdjustmentRequest(id),
      'Correction approuvée : le solde est mis à jour.', 'L’approbation a échoué')
  }

  function reject(id: string, note: string) {
    return decide(id, () => walletService.rejectAdjustmentRequest(id, note),
      'Correction rejetée : rien n’a été écrit.', 'Le rejet a échoué')
  }

  return { requests, isLoading, error, success, busyId, currentPage, totalPages, load, approve, reject }
}
