import { useApi } from '@/composables/useApi'
import type { IndividualFrequencyFlagRow } from '@/features/individual-frequency/types/index'

/** File « Particuliers à confirmer » côté administration, mêmes droits que la revue GP Pro. */
export const individualFrequencyService = {
  /** Le contrat sert un tableau ; une page Spring (`content`) reste tolérée. */
  async list(): Promise<IndividualFrequencyFlagRow[]> {
    const res = await useApi()<IndividualFrequencyFlagRow[] | { content?: IndividualFrequencyFlagRow[] } | null>(
      '/admin/individual-frequency-flags',
    )
    if (Array.isArray(res)) return res
    return Array.isArray(res?.content) ? res.content : []
  },
  /** 204, idempotent côté serveur. */
  dismiss(flagId: string): Promise<void> {
    return useApi()<void>(`/admin/individual-frequency-flags/${encodeURIComponent(flagId)}/dismiss`, { method: 'POST' })
  },
}
