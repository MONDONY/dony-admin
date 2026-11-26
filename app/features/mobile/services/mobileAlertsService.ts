import { useApi } from '@/composables/useApi'
import type { AdminAlert, AdminAlertPage, ResolvedFilter } from '@/features/alerts/types/index'

/** Mêmes filtres que le poste ordinateur : « ouvertes » hors reportées, reportées, résolues. */
function statusQuery(resolved: ResolvedFilter): Record<string, boolean> {
  if (resolved === 'OPEN') return { resolved: false, snoozed: false }
  if (resolved === 'SNOOZED') return { resolved: false, snoozed: true }
  if (resolved === 'RESOLVED') return { resolved: true }
  return {}
}

/**
 * Alertes depuis le mobile : lire la liste et une alerte, la prendre en charge, la libérer. Volontairement
 * distinct du service du poste ordinateur : ni résolution, ni report, ni réouverture n'est joignable ici.
 */
export const mobileAlertsService = {
  list(resolved: ResolvedFilter, page: number, size: number): Promise<AdminAlertPage> {
    return useApi()<AdminAlertPage>('/admin/alerts', { query: { page, size, ...statusQuery(resolved) } })
  },
  /** ALERT_VIEW ; 404 sans `code` sur un back qui ne l'a pas encore. */
  get(id: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${encodeURIComponent(id)}`)
  },
  /** ALERT_RESOLVE. 409 `alert-already-claimed` ; 404/405 sans code sur un back qui n'a pas la route. */
  claim(id: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${encodeURIComponent(id)}/claim`, { method: 'POST' })
  },
  /** Celui qui l'a prise, ou ADMIN_MANAGE (ALERT_RESOLVE dans les deux cas). 403 `alert-claim-not-yours`. */
  release(id: string): Promise<AdminAlert> {
    return useApi()<AdminAlert>(`/admin/alerts/${encodeURIComponent(id)}/claim`, { method: 'DELETE' })
  },
}
