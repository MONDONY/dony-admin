import { ref } from 'vue'
import { financeService } from '@/features/finance/services/financeService'
import type { AdminMobileMoneyCommissions } from '@/features/finance/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

/**
 * Tableau de bord des commissions mobile money, par période (aucun paramètre d'URL). Sans bornes,
 * le back retient les 12 derniers mois : l'écran n'invente pas de période par défaut.
 */
export function useMobileMoneyCommissions() {
  const data = ref<AdminMobileMoneyCommissions | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const from = ref<string | null>(null)
  const to = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try { data.value = await financeService.getMobileMoneyCommissionsForDays(from.value, to.value) }
    catch (e) { error.value = extractProblemMessage(e, 'Impossible de charger les commissions mobile money') }
    finally { loading.value = false }
  }
  /** Première visite de l'onglet (ou après un échec) : chargement. */
  async function ensure() { if (data.value === null && !loading.value) await load() }
  async function setPeriod(f: string | null, t: string | null) { from.value = f; to.value = t; await load() }

  return { data, loading, error, from, to, load, ensure, setPeriod }
}
