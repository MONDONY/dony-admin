import { ref } from 'vue'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { AdminDisputeDetail, DisputeResolution } from '@/features/incidents/types/index'

export function useDisputeDetail() {
  const dispute = ref<AdminDisputeDetail | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function open(id: string) {
    isLoading.value = true; error.value = null
    try { dispute.value = await incidentsService.getDispute(id) }
    catch (e) { error.value = (e as Error).message } finally { isLoading.value = false }
  }
  function close() { dispute.value = null }
  async function run(fn: () => Promise<AdminDisputeDetail>) {
    error.value = null
    try { dispute.value = await fn() } catch (e) { error.value = (e as Error).message }
  }
  const resolve = (resolution: DisputeResolution, note: string) => run(() => incidentsService.resolveDispute(dispute.value!.id, resolution, note))
  const payGuarantee = (amountCents: number, beneficiaryUserId: string, reason: string) => run(() => incidentsService.payGuaranteeFund(dispute.value!.id, amountCents, beneficiaryUserId, reason))

  return { dispute, isLoading, error, open, close, resolve, payGuarantee }
}
