import { reactive, ref } from 'vue'
import { promoService } from '@/features/promo/services/promoService'
import type { AdminPromoCode, PromoCodeInput, PromoFilterState } from '@/features/promo/types/index'

export function usePromoCodes() {
  const codes = ref<AdminPromoCode[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<PromoFilterState>({ active: null })

  async function fetchCodes() {
    isLoading.value = true
    error.value = null
    try {
      const page = await promoService.list(filters, currentPage.value, pageSize.value)
      codes.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchCodes() }
  async function setActiveFilter(v: boolean | null) { filters.active = v; currentPage.value = 0; await fetchCodes() }
  async function create(input: PromoCodeInput) { await promoService.create(input); await fetchCodes() }
  async function update(id: string, input: PromoCodeInput) { await promoService.update(id, input); await fetchCodes() }
  async function remove(id: string) { await promoService.remove(id); await fetchCodes() }

  return { codes, isLoading, error, totalPages, currentPage, pageSize, filters, fetchCodes, goToPage, setActiveFilter, create, update, remove }
}
