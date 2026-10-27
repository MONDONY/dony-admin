import { reportsService } from '@/features/signalements/services/reportsService'
import type { ReportContext } from '@/features/signalements/types/index'
import { useContextLoader } from '@/features/signalements/composables/useContextLoader'

/** Une réponse d'une autre forme (proxy, ancien back) n'est pas un contexte de signalement. */
export function isReportContext(value: unknown): value is ReportContext {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Contexte du signalement ouvert sur la conversation : le message visé et les deux personnes
 * (signalant, auteur). Lecture non bloquante (REPORT_VIEW) : sans elle la conversation s'affiche, sans
 * message mis en évidence ni fiches des participants.
 */
export function useModerationReportContext() {
  return useContextLoader<ReportContext>((id) => reportsService.getContext(id), isReportContext)
}
