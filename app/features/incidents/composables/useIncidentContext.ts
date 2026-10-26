import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { IncidentContext } from '@/features/incidents/types/index'
import { useContextLoader } from '@/features/signalements/composables/useContextLoader'

/**
 * Une vraie réponse porte toujours `related` et `history` (listes, jamais nulles donc jamais omises
 * par le back). Toute autre forme (proxy, ancien back) n'est pas un contexte d'incident.
 */
export function isIncidentContext(value: unknown): value is IncidentContext {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { related?: unknown; history?: unknown }
  return Array.isArray(v.related) && Array.isArray(v.history)
}

/**
 * Contexte de l'incident ouvert (lecture, courses, tolérance d'un ancien back : voir `useContextLoader`).
 * L'identifiant passé est la clé de la file (`dispute:<id>` ou `noshow:<id>`) : elle dit quel endpoint lire.
 */
export function useIncidentContext() {
  return useContextLoader<IncidentContext>((key) => {
    const sep = key.indexOf(':')
    const id = key.slice(sep + 1)
    return key.slice(0, sep) === 'noshow' ? incidentsService.getNoShowContext(id) : incidentsService.getDisputeContext(id)
  }, isIncidentContext)
}
