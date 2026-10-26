import { alertsService } from '@/features/alerts/services/alertsService'
import type { AlertContext } from '@/features/alerts/types/index'
import { useContextLoader } from '@/features/signalements/composables/useContextLoader'

/**
 * Une vraie réponse porte toujours `related` et `history` (listes, jamais nulles donc jamais omises
 * par le back). Toute autre forme (proxy, ancien back) n'est pas un contexte d'alerte.
 */
export function isAlertContext(value: unknown): value is AlertContext {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { related?: unknown; history?: unknown }
  return Array.isArray(v.related) && Array.isArray(v.history)
}

/** Contexte de l'alerte ouverte (lecture, courses, tolérance d'un ancien back : voir `useContextLoader`). */
export function useAlertContext() {
  return useContextLoader<AlertContext>((id) => alertsService.getContext(id), isAlertContext)
}
