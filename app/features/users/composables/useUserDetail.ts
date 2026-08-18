import { ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import type { AdminUserDetail } from '@/features/users/types/index'

export function useUserDetail() {
  const user = ref<AdminUserDetail | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function open(id: string) {
    isLoading.value = true
    error.value = null
    try { user.value = await usersService.get(id) }
    catch (e) { error.value = (e as Error).message }
    finally { isLoading.value = false }
  }
  function close() { user.value = null }

  async function run(fn: () => Promise<AdminUserDetail>) {
    error.value = null
    try { user.value = await fn() }
    catch (e) { error.value = (e as Error).message }
  }
  const suspend = (reason: string) => run(() => usersService.suspend(user.value!.id, reason))
  const ban = (reason: string) => run(() => usersService.ban(user.value!.id, reason))
  const unsuspend = () => run(() => usersService.unsuspend(user.value!.id))
  const setCommissionRate = (rate: number | null) => run(() => usersService.setCommissionRate(user.value!.id, rate))
  const suspendPublishing = (reason: string) =>
    run(async () => { await usersService.suspendPublishing(user.value!.id, reason); return usersService.get(user.value!.id) })
  const liftPublishing = () =>
    run(async () => { await usersService.liftPublishingSuspension(user.value!.id); return usersService.get(user.value!.id) })

  return { user, isLoading, error, open, close, suspend, ban, unsuspend, setCommissionRate, suspendPublishing, liftPublishing }
}
