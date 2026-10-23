import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { reasonViolationMessage } from '@/lib/restoreReason'
import type { AdminUserDetail } from '@/features/users/types/index'

interface Options {
  /** Identifiant du compte affiché maintenant (null si aucun). */
  getId: () => string | null
  /** Reçoit la fiche renvoyée par le serveur, seulement si le compte est toujours affiché. */
  // eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
  onUpdate: (detail: AdminUserDetail) => void
}

/**
 * Gestes sur le compte de la page /users/<id>. Remplace useUserDetail (dont l'état est celui du
 * tiroir) : une réponse qui arrive après un changement de compte est ignorée, jamais appliquée
 * à la fiche d'un autre utilisateur.
 */
export function useAccountActions({ getId, onUpdate }: Options) {
  const busy = ref(false)
  const error = ref<string | null>(null)
  /** POST /admin/users/{id}/cancel-deletion absent (ancien back) : bouton remplacé par un texte. */
  const cancelDeletionUnavailable = ref(false)
  /** Motif refusé (422 `violations`) : affiché dans le dialogue, saisie conservée. */
  const cancelDeletionReasonError = ref<string | null>(null)
  let seq = 0

  // eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
  async function run(fn: (id: string) => Promise<AdminUserDetail>, fallback = 'Action échouée') {
    const id = getId()
    if (!id || busy.value) return
    const mine = ++seq
    error.value = null
    busy.value = true
    try {
      const detail = await fn(id)
      if (getId() === id) onUpdate(detail)
    } catch (e) {
      if (getId() === id) error.value = extractProblemMessage(e, fallback)
    } finally {
      if (mine === seq) busy.value = false
    }
  }

  const suspend = (reason: string) => run(id => usersService.suspend(id, reason))
  const ban = (reason: string) => run(id => usersService.ban(id, reason))
  const unsuspend = () => run(id => usersService.unsuspend(id))
  const setCommissionRate = (rate: number | null) => run(id => usersService.setCommissionRate(id, rate))
  const muteMessaging = (durationHours: number | null, reason: string) =>
    run(id => usersService.muteMessaging(id, durationHours, reason))
  const unmuteMessaging = () => run(id => usersService.unmuteMessaging(id))
  const grantPro = (reason: string) => run(id => usersService.grantPro(id, reason))
  const revokePro = () => run(id => usersService.revokePro(id))
  // Ces deux gestes ne renvoient pas la fiche : on la relit, comme le tiroir.
  const suspendPublishing = (reason: string) =>
    run(async (id) => { await usersService.suspendPublishing(id, reason); return usersService.get(id) })
  const liftPublishing = () =>
    run(async (id) => { await usersService.liftPublishingSuspension(id); return usersService.get(id) })

  /** Rend true si la suppression est annulée ; la fiche est alors remplacée par la réponse. */
  async function cancelDeletion(reason: string): Promise<boolean> {
    const id = getId()
    if (!id || busy.value) return false
    const mine = ++seq
    error.value = null
    cancelDeletionReasonError.value = null
    busy.value = true
    try {
      const detail = await usersService.cancelDeletion(id, reason)
      if (getId() !== id) return false
      onUpdate(detail)
      return true
    } catch (e) {
      if (getId() !== id) return false
      const invalid = reasonViolationMessage(e)
      if (invalid) cancelDeletionReasonError.value = invalid
      else if (isEndpointMissing(e)) cancelDeletionUnavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible d’annuler la suppression')
      return false
    } finally {
      if (mine === seq) busy.value = false
    }
  }

  /** Changement de compte : plus rien de l'ancien (erreur, occupation, états d'annulation). */
  function reset() {
    seq++
    busy.value = false
    error.value = null
    cancelDeletionUnavailable.value = false
    cancelDeletionReasonError.value = null
  }

  return {
    busy, error, cancelDeletionUnavailable, cancelDeletionReasonError, reset,
    suspend, ban, unsuspend, suspendPublishing, liftPublishing, muteMessaging, unmuteMessaging,
    setCommissionRate, grantPro, revokePro, cancelDeletion,
  }
}
