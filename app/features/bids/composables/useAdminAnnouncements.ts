import { ref } from 'vue'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminAnnouncementListItem } from '@/features/bids/types/index'

/**
 * Le backend renvoie du RFC 7807 (`ProblemDetail`, ex. GlobalExceptionHandler
 * côté back) — le champ `detail` porte le message écrit pour un humain
 * (ex. « Des colis acceptés sont en cours sur cette annonce. » sur le 409
 * de removeByAdmin). `useApi()` (ofetch) expose le corps de réponse parsé
 * via `error.data`. On ne retombe sur `error.message` (générique, au format
 * `[POST] "url": 409 Conflict`) que si `data.detail` est absent.
 */
function extractMessage(e: unknown, fallback: string): string {
  const data = (e as { data?: { detail?: string } } | undefined)?.data
  if (typeof data?.detail === 'string' && data.detail.trim().length > 0) return data.detail
  return (e as Error)?.message || fallback
}

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

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      announcements.value = (await bidsAdminService.listAnnouncements(0, 20)).content
    } catch (e) {
      error.value = extractMessage(e, 'Impossible de charger les annonces')
    } finally {
      isLoading.value = false
    }
  }

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
      error.value = extractMessage(e, 'Action échouée')
    } finally {
      busy.value = false
    }
  }

  const remove = (id: string, publicReason: string, internalNote: string) =>
    run(() => bidsAdminService.removeAnnouncement(id, publicReason, internalNote))
  const restore = (id: string) => run(() => bidsAdminService.restoreAnnouncement(id))

  return { announcements, isLoading, error, busy, load, remove, restore }
}
