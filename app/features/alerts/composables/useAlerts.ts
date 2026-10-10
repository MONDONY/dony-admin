import { reactive, ref } from 'vue'
import { alertsService } from '@/features/alerts/services/alertsService'
import type { AdminAlert, AlertsFilterState, AlertSeverity, ResolvedFilter } from '@/features/alerts/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

export function useAlerts() {
  const alerts = ref<AdminAlert[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<AlertsFilterState>({ type: null, severity: null, resolved: 'OPEN' })

  async function fetchAlerts() {
    isLoading.value = true
    error.value = null
    try {
      const page = await alertsService.list(filters, currentPage.value, pageSize.value)
      alerts.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les alertes')
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchAlerts() }
  async function setResolvedFilter(r: ResolvedFilter) { filters.resolved = r; currentPage.value = 0; await fetchAlerts() }
  async function setSeverityFilter(s: AlertSeverity | null) { filters.severity = s; currentPage.value = 0; await fetchAlerts() }
  async function resolve(id: string, note: string) { await alertsService.resolve(id, note); await fetchAlerts() }

  /**
   * Alertes résolues par le back pendant une resynchronisation Stripe : marquées dans la liste
   * sans recharger (elle resterait sinon « Ouverte » jusqu'au prochain chargement).
   */
  function markResolvedLocally(ids: string[], at: string = new Date().toISOString()) {
    alerts.value = alerts.value.map(a => (ids.includes(a.id) && !a.resolved ? { ...a, resolved: true, resolvedAt: at } : a))
  }

  return { markResolvedLocally, alerts, isLoading, error, totalPages, currentPage, pageSize, filters, fetchAlerts, goToPage, setResolvedFilter, setSeverityFilter, resolve }
}
