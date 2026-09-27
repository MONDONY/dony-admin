import { ref } from 'vue'
import { walletService } from '@/features/wallet/services/walletService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { newIdempotencyKey } from '@/lib/idempotencyKey'
import type { WalletAdjustmentRequest, WalletAdjustmentResult } from '@/features/wallet/types/index'

/**
 * Correction manuelle d'un solde, avec sa clé d'idempotence.
 *
 * La clé naît à l'ouverture du dialogue (`begin`) et survit à un échec : une nouvelle
 * tentative de la MÊME demande après une coupure réseau réutilise la clé, et le back ne
 * l'applique qu'une fois si la première était en fait passée. Une demande MODIFIÉE (autre
 * montant, autre motif) prend une clé neuve, sans quoi le back répondrait 409
 * `wallet-adjustment-idempotency-conflict`. Après un succès, la clé est renouvelée pour
 * que la correction suivante ne soit pas prise pour un rejeu.
 */
export function useWalletAdjustment(userId: string) {
  const idempotencyKey = ref<string>('')
  const busy = ref(false)
  const error = ref<string | null>(null)
  /** Empreinte de la demande déjà envoyée avec la clé courante. */
  let sentWithKey: string | null = null

  function renewKey() {
    idempotencyKey.value = newIdempotencyKey()
    sentWithKey = null
  }

  function begin() {
    renewKey()
    error.value = null
  }

  async function submit(request: WalletAdjustmentRequest): Promise<WalletAdjustmentResult | null> {
    const fingerprint = JSON.stringify([request.currency, request.direction, request.amount, request.reason])
    if (!idempotencyKey.value || (sentWithKey !== null && sentWithKey !== fingerprint)) renewKey()
    sentWithKey = fingerprint
    busy.value = true
    error.value = null
    try {
      const result = await walletService.adjust(userId, request, idempotencyKey.value)
      renewKey()
      return result
    } catch (e) {
      error.value = extractProblemMessage(e, 'La correction du solde a échoué')
      return null
    } finally {
      busy.value = false
    }
  }

  return { idempotencyKey, busy, error, begin, submit }
}
