import { supportService } from '@/features/support/services/supportService'
import type { SupportContext } from '@/features/support/types/index'
import { useContextLoader } from '@/features/signalements/composables/useContextLoader'

/**
 * Une vraie réponse porte toujours `history` et `notes` (listes, jamais nulles donc jamais omises par le
 * back). Toute autre forme (proxy, ancien back) n'est pas un contexte de ticket.
 */
export function isSupportContext(value: unknown): value is SupportContext {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { history?: unknown; notes?: unknown }
  return Array.isArray(v.history) && Array.isArray(v.notes)
}

/** Historique tracé et notes du ticket ouvert (lecture, courses, tolérance d'un ancien back : voir `useContextLoader`). */
export function useSupportContext() {
  return useContextLoader<SupportContext>((id) => supportService.getContext(id), isSupportContext)
}
