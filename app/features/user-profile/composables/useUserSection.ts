import { ref } from 'vue'
import { userProfileService } from '@/features/user-profile/services/userProfileService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { UserSection } from '@/features/user-profile/types/index'

const PAGE_SIZE = 20

export function useUserSection<T>(userId: string, section: UserSection, extra?: Record<string, string>) {
  const rows = ref<T[]>([]) as { value: T[] }
  const page = ref(0)
  const totalPages = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  let seq = 0

  async function fetchPage(p: number): Promise<void> {
    const my = ++seq
    isLoading.value = true
    error.value = null
    try {
      const res = await userProfileService.section<T>(userId, section, p, PAGE_SIZE, extra)
      if (my !== seq) return
      rows.value = res.content
      totalPages.value = res.totalPages
      page.value = p
      loaded.value = true
    } catch (e) {
      if (my !== seq) return
      error.value = extractProblemMessage(e, 'Impossible de charger cette section')
    } finally {
      if (my === seq) isLoading.value = false
    }
  }

  /** Premier chargement seulement : un onglet déjà chargé ne rappelle pas le serveur. */
  async function load(): Promise<void> {
    if (loaded.value) return
    await fetchPage(page.value)
  }

  function goToPage(p: number): Promise<void> {
    return fetchPage(p)
  }

  /** Recharge la page courante (après une action qui change la liste). */
  function reload(): Promise<void> {
    return fetchPage(page.value)
  }

  return { rows, page, totalPages, isLoading, error, loaded, load, goToPage, reload }
}
