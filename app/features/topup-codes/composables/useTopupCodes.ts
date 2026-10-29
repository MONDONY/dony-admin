import { computed, reactive, ref } from 'vue'
import { topupCodesService } from '@/features/topup-codes/services/topupCodesService'
import type { AdminTopupCode, TopupCodeDisplayStatus, TopupCodeFilterState, TopupCodeInput } from '@/features/topup-codes/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

const PAGE_SIZE = 20

export function useTopupCodes() {
  const allCodes = ref<AdminTopupCode[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(0)
  const filters = reactive<TopupCodeFilterState>({ status: null })

  const filtered = computed(() =>
    filters.status === null ? allCodes.value : allCodes.value.filter((c) => c.displayStatus === filters.status))
  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
  const codes = computed(() =>
    filtered.value.slice(currentPage.value * PAGE_SIZE, (currentPage.value + 1) * PAGE_SIZE))

  async function fetchCodes() {
    isLoading.value = true
    error.value = null
    try {
      const result = await topupCodesService.list()
      allCodes.value = Array.isArray(result) ? result : []
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les codes de recharge')
    } finally {
      isLoading.value = false
    }
  }

  /** Les écritures exposent l'erreur ET la relancent : le formulaire reste ouvert sur un échec. */
  async function guarded<T>(fallback: string, run: () => Promise<T>): Promise<T> {
    error.value = null
    try {
      return await run()
    } catch (e) {
      error.value = extractProblemMessage(e, fallback)
      throw e
    }
  }

  function goToPage(p: number) { currentPage.value = p }
  function setStatusFilter(v: TopupCodeDisplayStatus | null) { filters.status = v; currentPage.value = 0 }
  /** Renvoie le code créé : sa réponse est la seule à porter le code en clair. */
  async function create(input: TopupCodeInput): Promise<AdminTopupCode> {
    const created = await guarded('Impossible de créer le code', () => topupCodesService.create(input))
    await fetchCodes()
    return created
  }
  async function revoke(id: string) {
    await guarded('Impossible de révoquer le code', () => topupCodesService.revoke(id))
    await fetchCodes()
  }
  function generateCode() {
    return guarded('Impossible de générer un code', () => topupCodesService.generateCode())
  }

  return { codes, isLoading, error, totalPages, currentPage, filters, fetchCodes, goToPage, setStatusFilter, create, revoke, generateCode }
}
