import { ref } from 'vue'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import type { SpringPage } from '@/features/gp-pro/types/index'

const PAGE_SIZE = 20

/** Lit une page : (numéro de page, taille). */
// eslint-disable-next-line no-unused-vars -- paramètres d'un type de fonction, pas des variables
type PageFetcher<T> = (page: number, size: number) => Promise<SpringPage<T>>

/**
 * Liste paginée côté serveur (file des demandes ou revue des titulaires). `unavailable` :
 * ancien back sans l'endpoint (règle des PR jumelles), mention discrète au lieu d'une erreur.
 */
export function useGpProList<T>(fetchPage: PageFetcher<T>, fallback: string) {
  const items = ref<T[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const unavailable = ref(false)
  const currentPage = ref(0)
  const totalPages = ref(0)
  const totalElements = ref(0)

  /** La page courante ne change qu'une fois la nouvelle page reçue : un échec garde l'ancienne. */
  async function load(page = currentPage.value) {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetchPage(page, PAGE_SIZE)
      items.value = (res.content ?? []) as T[]
      totalPages.value = res.totalPages ?? 0
      totalElements.value = res.totalElements ?? items.value.length
      currentPage.value = res.number ?? page
      unavailable.value = false
    } catch (e) {
      if (isEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, fallback)
    } finally {
      isLoading.value = false
    }
  }

  return { items, isLoading, error, unavailable, currentPage, totalPages, totalElements, load, goToPage: load }
}
