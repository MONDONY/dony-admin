import { reactive, ref } from 'vue'
import { ratingsService } from '@/features/signalements/services/ratingsService'
import type { AdminRating, RatingsFilterState } from '@/features/signalements/types/index'

export function useRatings() {
  const ratings = ref<AdminRating[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<RatingsFilterState>({ flaggedOnly: false })

  async function fetchRatings() {
    isLoading.value = true
    error.value = null
    try {
      const page = await ratingsService.list(filters, currentPage.value, pageSize.value)
      ratings.value = page.content
      totalPages.value = page.totalPages
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchRatings() }
  async function setFlaggedOnly(v: boolean) { filters.flaggedOnly = v; currentPage.value = 0; await fetchRatings() }
  async function exclude(id: string, excluded: boolean, reason: string) {
    await ratingsService.exclude(id, excluded, reason)
    await fetchRatings()
  }
  async function remove(id: string) {
    await ratingsService.remove(id)
    await fetchRatings()
  }

  return { ratings, isLoading, error, totalPages, currentPage, pageSize, filters, fetchRatings, goToPage, setFlaggedOnly, exclude, remove }
}
