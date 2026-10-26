import { ref } from 'vue'
import { alertsService } from '@/features/alerts/services/alertsService'
import { summarizeAlerts, type AlertSummary } from '@/features/alerts/lib/alertWorkbench'

const EMPTY: AlertSummary = { critical: 0, warn: 0, info: 0, oldestCritical: null, warnGroups: 0, resolvedThisWeek: 0 }

/**
 * Compteurs du bandeau : toutes les alertes ouvertes (pas seulement la page de la file) et les
 * résolues récentes. Une panne du bandeau ne bloque jamais le poste : il reste simplement à zéro.
 */
export function useAlertSummary() {
  const summary = ref<AlertSummary>({ ...EMPTY })
  const loaded = ref(false)

  async function refresh() {
    try {
      const [open, resolved] = await Promise.all([
        alertsService.list({ type: null, severity: null, resolved: 'OPEN' }, 0, 200),
        alertsService.list({ type: null, severity: null, resolved: 'RESOLVED' }, 0, 100),
      ])
      summary.value = summarizeAlerts(open.content, resolved.content)
      loaded.value = true
    } catch {
      loaded.value = false
    }
  }

  return { summary, loaded, refresh }
}
