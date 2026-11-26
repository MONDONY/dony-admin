import { computed, ref } from 'vue'
import { overviewService } from '@/features/overview/services/overviewService'
import type { AdminOverview, OverviewPeriod } from '@/features/overview/types/index'
import { buildQueueRows, buildTiles, DEFAULT_PERIOD } from '@/features/mobile/lib/mobileOverview'
import { useAuthStore } from '@/stores/auth'
import { extractProblemMessage } from '@/lib/problemDetail'

/** Vue d'ensemble mobile : lecture seule, période au choix, réponses en retard ignorées. */
export function useMobileOverview() {
  const auth = useAuthStore()
  const period = ref<OverviewPeriod>(DEFAULT_PERIOD)
  const data = ref<AdminOverview | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let seq = 0

  const tiles = computed(() => (data.value ? buildTiles(data.value) : []))
  const queueRows = computed(() => (data.value ? buildQueueRows(data.value) : []))
  /** Un back qui ignore `period` ne renvoie pas le bloc : puces et tuiles de période disparaissent. */
  const hasPeriod = computed(() => !!data.value?.period)
  const canOpenAlerts = computed(() => auth.can('ALERT_VIEW'))

  async function load() {
    const my = ++seq
    isLoading.value = true
    error.value = null
    try {
      const result = await overviewService.fetch(period.value)
      if (my === seq) data.value = result
    } catch (e) {
      if (my === seq) error.value = extractProblemMessage(e, 'Impossible de charger la vue d’ensemble')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  async function selectPeriod(next: OverviewPeriod) {
    period.value = next
    await load()
  }

  return { period, data, tiles, queueRows, hasPeriod, canOpenAlerts, isLoading, error, load, selectPeriod }
}
