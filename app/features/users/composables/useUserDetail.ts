import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { reasonViolationMessage } from '@/lib/restoreReason'
import type { AdminUserDetail } from '@/features/users/types/index'

export function useUserDetail() {
  const user = ref<AdminUserDetail | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)
  /** POST /admin/users/{id}/cancel-deletion absent (ancien back) : bouton masqué. */
  const cancelDeletionUnavailable = ref(false)
  /** Motif refusé (422 `violations`) : affiché dans le dialogue, saisie conservée. */
  const cancelDeletionReasonError = ref<string | null>(null)

  async function open(id: string) {
    isLoading.value = true
    error.value = null
    try { user.value = await usersService.get(id) }
    catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger l\'utilisateur') }
    finally { isLoading.value = false }
  }
  function close() { user.value = null }

  async function run(fn: () => Promise<AdminUserDetail>) {
    error.value = null
    busy.value = true
    try { user.value = await fn() }
    catch (e) { error.value = extractProblemMessage(e, 'Action échouée') }
    finally { busy.value = false }
  }
  const suspend = (reason: string) => run(() => usersService.suspend(user.value!.id, reason))
  const ban = (reason: string) => run(() => usersService.ban(user.value!.id, reason))
  const unsuspend = () => run(() => usersService.unsuspend(user.value!.id))
  const setCommissionRate = (rate: number | null) => run(() => usersService.setCommissionRate(user.value!.id, rate))
  const suspendPublishing = (reason: string) =>
    run(async () => { await usersService.suspendPublishing(user.value!.id, reason); return usersService.get(user.value!.id) })
  const liftPublishing = () =>
    run(async () => { await usersService.liftPublishingSuspension(user.value!.id); return usersService.get(user.value!.id) })
  const muteMessaging = (durationHours: number | null, reason: string) =>
    run(() => usersService.muteMessaging(user.value!.id, durationHours, reason))
  const unmuteMessaging = () => run(() => usersService.unmuteMessaging(user.value!.id))
  const grantPro = (reason: string) => run(() => usersService.grantPro(user.value!.id, reason))
  const revokePro = () => run(() => usersService.revokePro(user.value!.id))

  /** Rend true si la suppression est annulée ; la fiche est remplacée par la réponse. */
  async function cancelDeletion(reason: string): Promise<boolean> {
    if (!user.value) return false
    const id = user.value.id
    error.value = null
    cancelDeletionReasonError.value = null
    busy.value = true
    try {
      user.value = await usersService.cancelDeletion(id, reason)
      return true
    } catch (e) {
      const invalid = reasonViolationMessage(e)
      if (invalid) cancelDeletionReasonError.value = invalid
      else if (isEndpointMissing(e)) cancelDeletionUnavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible d’annuler la suppression')
      return false
    } finally {
      busy.value = false
    }
  }

  return {
    cancelDeletion, cancelDeletionUnavailable, cancelDeletionReasonError,
    user, isLoading, error, busy, open, close, suspend, ban, unsuspend, setCommissionRate,
    suspendPublishing, liftPublishing, muteMessaging, unmuteMessaging, grantPro, revokePro,
  }
}
