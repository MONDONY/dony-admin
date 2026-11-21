import { computed, reactive, ref } from 'vue'
import { promoService } from '@/features/promo/services/promoService'
import type { AdminPromoCode, PromoCodeInput, PromoFilterState, PromoOriginFilter, PromoStatus } from '@/features/promo/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'

const PAGE_SIZE = 20

export function usePromoCodes() {
  const allCodes = ref<AdminPromoCode[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(0)
  const filters = reactive<PromoFilterState>({ status: null, origin: 'ALL' })
  const actionError = ref<string | null>(null)

  const filtered = computed(() =>
    filters.status === null ? allCodes.value : allCodes.value.filter((c) => c.status === filters.status))
  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
  const codes = computed(() =>
    filtered.value.slice(currentPage.value * PAGE_SIZE, (currentPage.value + 1) * PAGE_SIZE))

  async function fetchCodes() {
    isLoading.value = true
    error.value = null
    try {
      const result = await promoService.list(filters.origin)
      // Garde-fou : tolère une réponse inattendue (mock périmé, erreur proxy).
      allCodes.value = Array.isArray(result) ? result : []
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les codes promo')
    } finally {
      isLoading.value = false
    }
  }

  function goToPage(p: number) { currentPage.value = p }
  function setStatusFilter(v: PromoStatus | null) { filters.status = v; currentPage.value = 0 }
  async function setOriginFilter(v: PromoOriginFilter) { filters.origin = v; currentPage.value = 0; await fetchCodes() }
  function clearActionError() { actionError.value = null }
  function isConflict(e: unknown): boolean {
    const x = e as { status?: number; statusCode?: number; response?: { status?: number } } | undefined
    return x?.status === 409 || x?.statusCode === 409 || x?.response?.status === 409
  }
  /** Le back refuse (409) de modifier ou supprimer un code de parrainage : message clair, pas d'exception. */
  async function guarded(run: () => Promise<unknown>, conflictMessage: string, fallback: string) {
    actionError.value = null
    try {
      await run()
      await fetchCodes()
    } catch (e) {
      actionError.value = isConflict(e) ? conflictMessage : extractProblemMessage(e, fallback)
    }
  }
  async function create(input: PromoCodeInput) { await promoService.create(input); await fetchCodes() }
  function update(id: string, input: PromoCodeInput) {
    return guarded(() => promoService.update(id, input),
      'Ce code vient du parrainage : il ne peut pas être modifié. Seul son statut peut changer.',
      'Impossible de modifier le code promo')
  }
  async function setStatus(id: string, status: PromoStatus) { await promoService.setStatus(id, status); await fetchCodes() }
  function remove(id: string) {
    return guarded(() => promoService.remove(id),
      'Ce code vient du parrainage : il ne peut pas être supprimé. Désactivez-le si besoin.',
      'Impossible de supprimer le code promo')
  }

  return { codes, isLoading, error, totalPages, currentPage, filters, actionError, fetchCodes, goToPage, setStatusFilter, setOriginFilter, clearActionError, create, update, setStatus, remove }
}
