import { ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import { extractProblemMessage } from '@/lib/problemDetail'
import type { AdminAnnouncementListItem } from '@/features/bids/types/index'

/**
 * État + actions de la table des annonces (onglet « Annonces » de /colis) :
 * chargement de la liste, et retrait/restauration avec substitution de la
 * ligne concernée — jamais de rechargement complet de la liste. Isolé dans
 * un composable (plutôt que directement dans la page) pour rester testable
 * sans monter la page, sur le même patron que `usePaymentDetail`/`useUserDetail`.
 */
export function useAdminAnnouncements() {
  const announcements = ref<AdminAnnouncementListItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const busy = ref(false)
  const currentPage = ref(0)
  const totalPages = ref(0)
  const pageSize = 20

  /** La page courante ne change qu'une fois la nouvelle page reçue : un échec laisse l'ancienne affichée. */
  async function load(page = currentPage.value) {
    isLoading.value = true
    error.value = null
    try {
      const res = await bidsAdminService.listAnnouncements(page, pageSize)
      announcements.value = res.content
      totalPages.value = res.totalPages
      currentPage.value = page
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les annonces')
    } finally {
      isLoading.value = false
    }
  }
  const goToPage = (page: number) => load(page)

  function replace(updated: AdminAnnouncementListItem) {
    const idx = announcements.value.findIndex((a) => a.id === updated.id)
    if (idx !== -1) announcements.value[idx] = updated
  }

  async function run(fn: () => Promise<AdminAnnouncementListItem>) {
    error.value = null
    busy.value = true
    try {
      replace(await fn())
    } catch (e) {
      error.value = extractProblemMessage(e, 'Action échouée')
    } finally {
      busy.value = false
    }
  }

  const remove = (id: string, publicReason: string, internalNote: string) =>
    run(() => bidsAdminService.removeAnnouncement(id, publicReason, internalNote))
  const restore = (id: string) => run(() => bidsAdminService.restoreAnnouncement(id))

  return { announcements, isLoading, error, busy, currentPage, totalPages, load, goToPage, remove, restore }
}
