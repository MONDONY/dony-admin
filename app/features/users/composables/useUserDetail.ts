import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import type { AdminUserDetail } from '@/features/users/types/index'

/**
 * Le backend renvoie du RFC 7807 (`ProblemDetail`) — le champ `detail` porte
 * le message écrit pour un humain. `useApi()` (ofetch) expose le corps de
 * réponse parsé via `error.data`. On ne retombe sur `error.message`
 * (générique) que si `data.detail` est absent. Même motif que
 * `useAdminAnnouncements` (Task 9).
 */
function extractMessage(e: unknown, fallback: string): string {
  const data = (e as { data?: { detail?: string } } | undefined)?.data
  if (typeof data?.detail === 'string' && data.detail.trim().length > 0) return data.detail
  return (e as Error)?.message || fallback
}

export function useUserDetail() {
  const user = ref<AdminUserDetail | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)

  async function open(id: string) {
    isLoading.value = true
    error.value = null
    try { user.value = await usersService.get(id) }
    catch (e) { error.value = extractMessage(e, 'Impossible de charger l\'utilisateur') }
    finally { isLoading.value = false }
  }
  function close() { user.value = null }

  async function run(fn: () => Promise<AdminUserDetail>) {
    error.value = null
    busy.value = true
    try { user.value = await fn() }
    catch (e) { error.value = extractMessage(e, 'Action échouée') }
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

  return {
    user, isLoading, error, busy, open, close, suspend, ban, unsuspend, setCommissionRate,
    suspendPublishing, liftPublishing, muteMessaging, unmuteMessaging,
  }
}
