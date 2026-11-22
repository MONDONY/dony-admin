import { ref } from 'vue'
import { paymentsService } from '@/features/payments/services/paymentsService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminCancellationFee } from '@/features/payments/types/index'

/**
 * Retenue d'annulation du colis d'un paiement. Elle se charge à côté de la fiche, sans jamais la
 * bloquer : pas de retenue (404) = pas de carte ; toute autre erreur reste dans la zone de la
 * carte (`loadError`) et ne casse pas le tiroir.
 */
export function useCancellationFee() {
  const fee = ref<AdminCancellationFee | null>(null)
  const loadError = ref<string | null>(null)
  /** Geste en cours : un second envoi est ignoré. */
  const busy = ref(false)
  /** Erreur du dernier geste (détail du back, tel quel) ; le dialogue la montre près de la saisie. */
  const actionError = ref<string | null>(null)
  /** Résultat du dernier geste réussi. */
  const notice = ref<string | null>(null)
  /** Numéro du dernier chargement : une réponse tardive d'un autre colis ne réécrit rien. */
  let generation = 0

  async function load(bidId: string | null | undefined) {
    const mine = ++generation
    fee.value = null
    loadError.value = null
    notice.value = null
    actionError.value = null
    if (!bidId) return
    try {
      const result = await paymentsService.getCancellationFee(bidId)
      if (mine === generation) fee.value = result
    } catch (e) {
      if (mine === generation) loadError.value = extractProblemMessage(e, 'Impossible de charger les frais d’annulation.')
    }
  }

  /** Relecture silencieuse après un geste : en échec, la réponse du geste reste affichée. */
  async function refresh() {
    const current = fee.value
    if (!current) return
    const mine = generation
    try {
      const result = await paymentsService.getCancellationFee(current.bidId)
      if (mine === generation && result) fee.value = result
    } catch { /* la réponse du geste reste affichée */ }
  }

  async function run(call: () => Promise<AdminCancellationFee>, success: string): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    actionError.value = null
    notice.value = null
    const mine = generation
    try {
      const result = await call()
      if (mine === generation) fee.value = result
      notice.value = success
      await refresh()
      return true
    } catch (e) {
      actionError.value = extractProblemMessage(e, 'Action échouée')
      return false
    } finally {
      busy.value = false
    }
  }

  const waive = (reason: string) => run(
    () => paymentsService.waiveCancellationFee(fee.value!.bidId, reason.trim()),
    'Retenue levée : le prochain remboursement de l’expéditeur sera intégral. Lancez maintenant le remboursement habituel.',
  )
  const retryPayout = (reason: string) => run(
    () => paymentsService.retryCancellationFeePayout(fee.value!.id, reason.trim()),
    'Versement relancé : les essais automatiques reprennent. Vérifiez le nouveau statut.',
  )
  function clearAction() { actionError.value = null }

  return { fee, loadError, busy, actionError, notice, load, refresh, waive, retryPayout, clearAction }
}
