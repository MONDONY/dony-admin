import { computed, onMounted, watch, type ComputedRef } from 'vue'
import { useFinanceCounts } from '@/features/transactions/composables/useFinanceCounts'
import type { FinanceCounts } from '@/features/transactions/types'

/**
 * Nombres des sections Transactions pour la pastille du menu : chargés au montage puis à chaque
 * rafraîchissement des compteurs du menu (`trigger`, même minuteur que la cloche), seulement si
 * `enabled` (PAYMENT_VIEW). `null` tant qu'ils manquent (ancien back, erreur, pas de droit) :
 * la pastille garde alors ses clés actuelles.
 */
export function useNavFinanceCounts(trigger: () => unknown, enabled: () => boolean): ComputedRef<FinanceCounts | null> {
  const finance = useFinanceCounts()
  const refresh = () => { if (enabled()) void finance.reload() }
  onMounted(refresh)
  watch(trigger, refresh)
  return computed(() => (enabled() && !finance.unavailable.value ? finance.counts.value : null))
}
