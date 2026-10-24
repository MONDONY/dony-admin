import { useApi } from '@/composables/useApi'
import type { FinanceCounts } from '@/features/transactions/types'

export const transactionsService = {
  /**
   * Pastilles des sections. Une route absente (back pas encore déployé) est une erreur
   * `isEndpointMissing` laissée à l'appelant : c'est lui qui masque les pastilles.
   */
  counts(): Promise<FinanceCounts> {
    return useApi()<FinanceCounts>('/admin/finance/counts')
  },
}
