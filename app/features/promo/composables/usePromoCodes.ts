import { computed, reactive, ref } from 'vue'
import { promoService } from '@/features/promo/services/promoService'
import type { AdminPromoCode, PromoCodeInput, PromoFilterState, PromoStatus } from '@/features/promo/types/index'

const PAGE_SIZE = 20

export function usePromoCodes() {
  const allCodes = ref<AdminPromoCode[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(0)
  const filters = reactive<PromoFilterState>({ status: null })

  const filtered = computed(() =>
    filters.status === null ? allCodes.value : allCodes.value.filter((c) => c.status === filters.status))
  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
  const codes = computed(() =>
    filtered.value.slice(currentPage.value * PAGE_SIZE, (currentPage.value + 1) * PAGE_SIZE))

  async function fetchCodes() {
    isLoading.value = true
    error.value = null
    try {
      const result = await promoService.list()
      // Garde-fou : tolère une réponse inattendue (mock périmé, erreur proxy).
      allCodes.value = Array.isArray(result) ? result : []
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  function goToPage(p: number) { currentPage.value = p }
  function setStatusFilter(v: PromoStatus | null) { filters.status = v; currentPage.value = 0 }
  async function create(input: PromoCodeInput) { await promoService.create(input); await fetchCodes() }
  async function update(id: string, input: PromoCodeInput) { await promoService.update(id, input); await fetchCodes() }
  async function setStatus(id: string, status: PromoStatus) { await promoService.setStatus(id, status); await fetchCodes() }
  async function remove(id: string) { await promoService.remove(id); await fetchCodes() }

  return { codes, isLoading, error, totalPages, currentPage, filters, fetchCodes, goToPage, setStatusFilter, create, update, setStatus, remove }
}
