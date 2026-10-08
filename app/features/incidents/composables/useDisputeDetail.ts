import { ref } from 'vue'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { AdminDisputeDetail, AdminDisputeSplitOptions, DisputeResolution } from '@/features/incidents/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

export function useDisputeDetail() {
  const dispute = ref<AdminDisputeDetail | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Montants répartissables (null : back antérieur ou lecture impossible, le formulaire se masque). */
  const splitOptions = ref<AdminDisputeSplitOptions | null>(null)

  async function loadSplitOptions(id: string) {
    try { splitOptions.value = await incidentsService.getSplitOptions(id) } catch { splitOptions.value = null }
  }

  async function open(id: string) {
    isLoading.value = true; error.value = null
    splitOptions.value = null
    try {
      dispute.value = await incidentsService.getDispute(id)
      if (dispute.value?.status === 'OPEN') await loadSplitOptions(id)
    }
    catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger le litige') } finally { isLoading.value = false }
  }
  function close() { dispute.value = null; splitOptions.value = null }
  async function run(fn: () => Promise<AdminDisputeDetail>) {
    error.value = null
    try { dispute.value = await fn() } catch (e) { error.value = extractProblemMessage(e, 'Action échouée') }
  }
  const resolve = (resolution: DisputeResolution, note: string) => run(() => incidentsService.resolveDispute(dispute.value!.id, resolution, note))
  const payGuarantee = (amountCents: number, beneficiaryUserId: string, reason: string, currency?: string | null) =>
    run(() => incidentsService.payGuaranteeFund(dispute.value!.id, amountCents, beneficiaryUserId, reason, currency))

  const resolveWithSplit = (senderRefund: number, travelerPayout: number, note: string) =>
    run(() => incidentsService.resolveDisputeWithSplit(dispute.value!.id, senderRefund, travelerPayout, note))
  const retrySplit = () => run(() => incidentsService.retrySplit(dispute.value!.id))

  return { dispute, isLoading, error, splitOptions, open, close, resolve, payGuarantee, resolveWithSplit, retrySplit }
}
