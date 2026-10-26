import { reportsService } from '@/features/signalements/services/reportsService'
import type { ReportContext } from '@/features/signalements/types/index'
import { useContextLoader } from './useContextLoader'

/**
 * Une vraie réponse porte toujours `messagesRestricted` (booléen, jamais nul donc jamais omis par
 * le back). Toute autre forme (proxy, ancien back qui répondrait autre chose) n'est pas un contexte.
 */
function isReportContext(value: unknown): value is ReportContext {
  return typeof value === 'object' && value !== null
    && typeof (value as { messagesRestricted?: unknown }).messagesRestricted === 'boolean'
}

/** Contexte du signalement ouvert (lecture, courses, tolérance d'un ancien back : voir `useContextLoader`). */
export function useReportContext() {
  return useContextLoader<ReportContext>((id) => reportsService.getContext(id), isReportContext)
}
