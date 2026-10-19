import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { commissionGridService } from '@/features/commission-grid/services/commissionGridService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { violationsByField } from '@/lib/violations'
import { parseDecimalInput } from '@/features/commission-grid/utils/grid'
import type {
  CommissionCurrency, CommissionGridRequest, Decimal, SimulationRow,
} from '@/features/commission-grid/types/index'

export const SIMULATOR_DEBOUNCE_MS = 400
export const VAT_STORAGE_KEY = 'yadony-admin-commission-vat'
const DEFAULT_VAT = '20'

/** Grille simulée : une grille existante, ou un brouillon (aucune grille encore programmée). */
export type SimulatorSource = { gridId: string } | { draft: CommissionGridRequest }

/** TVA mémorisée par navigateur : un stockage bloqué (navigation privée) retombe sur 20 %. */
function readVat(): string {
  try {
    const v = localStorage.getItem(VAT_STORAGE_KEY)
    return v !== null && parseDecimalInput(v) !== null ? v : DEFAULT_VAT
  } catch {
    return DEFAULT_VAT
  }
}
function writeVat(v: string) {
  try {
    localStorage.setItem(VAT_STORAGE_KEY, v)
  } catch { /* stockage indisponible : la TVA n'est simplement pas retenue */ }
}

/**
 * Simulateur de marge : pour un montant net et une devise, la commission de la grille choisie et,
 * par moyen de paiement, le coût du prestataire et la marge hors taxes. Recalculé après un temps
 * de repos de la saisie ; une réponse périmée est ignorée.
 */
export function useMarginSimulator(source: Ref<SimulatorSource | null>, delayMs = SIMULATOR_DEBOUNCE_MS) {
  const amount = ref('20')
  const currency = ref<CommissionCurrency>('EUR')
  const vatPercent = ref(readVat())

  const row = ref<SimulationRow | null>(null)
  const connectMonthly = ref<Decimal | null>(null)
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  const isLoading = ref(false)

  /** Erreur de saisie locale : pas d'appel tant qu'elle est là. */
  const inputError = computed<string | null>(() => {
    const a = parseDecimalInput(amount.value)
    if (a === null || a <= 0) return 'Saisissez un montant net positif.'
    const v = parseDecimalInput(vatPercent.value)
    if (v === null || v < 0) return 'Saisissez un taux de TVA positif ou nul.'
    return null
  })

  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0
  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function run(): Promise<void> {
    clearTimer()
    const mine = ++seq
    const src = source.value
    if (!src || inputError.value) {
      row.value = null
      isLoading.value = false
      return
    }
    isLoading.value = true
    try {
      const res = await commissionGridService.simulate({
        ...src,
        currency: currency.value,
        nets: [parseDecimalInput(amount.value) as number],
        vatRatePercent: parseDecimalInput(vatPercent.value) as number,
      })
      if (mine !== seq) return
      row.value = res.rows?.[0] ?? null
      connectMonthly.value = res.connectActiveAccountMonthly ?? null
      error.value = null
      unavailable.value = false
    } catch (e) {
      if (mine !== seq) return
      row.value = null
      if (isEndpointMissing(e)) {
        unavailable.value = true
        return
      }
      const v = violationsByField(e)
      error.value = Object.values(v)[0] ?? extractProblemMessage(e, 'La simulation n’a pas pu être calculée')
    } finally {
      if (mine === seq) isLoading.value = false
    }
  }

  watch(vatPercent, (v) => {
    if (parseDecimalInput(v) !== null) writeVat(v)
  })

  watch([amount, currency, vatPercent, source], () => {
    clearTimer()
    timer = setTimeout(() => { void run() }, delayMs)
  }, { deep: true })

  onScopeDispose(clearTimer)

  return {
    amount, currency, vatPercent, row, connectMonthly, error, unavailable, isLoading, inputError, run,
  }
}
