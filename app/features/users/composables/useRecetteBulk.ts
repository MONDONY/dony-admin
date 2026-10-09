import { computed, ref } from 'vue'
import { usersService } from '@/features/users/services/usersService'
import { useAuthStore } from '@/stores/auth'
import { extractProblemMessage } from '@/lib/problemDetail'
import { problemCode } from '@/lib/endpointMissing'
import type { UsersFilterState } from '@/features/users/types/index'

/**
 * Sélection multiple de la liste des utilisateurs et désignation des testeurs du mode recette
 * en masse (yadony-back#465).
 *
 * Rien ne s'affiche tant que deux conditions ne sont pas réunies : l'admin a `ADMIN_MANAGE`, et
 * `GET /admin/recette/status` répond `enabled: true` (staging). Un back plus ancien (404), un
 * refus ou une panne réseau laissent simplement la fonctionnalité cachée.
 */
export const RECETTE_BULK_MAX = 200
export type RecetteBulkFeedback = { tone: 'success' | 'error'; text: string }

const FEEDBACK_MS = 6000

function httpStatus(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/** « 12 comptes passés en mode recette (2 déjà testeurs, 1 introuvable). » */
export function bulkSuccessMessage(enabled: boolean, updated: number, unchanged: number, notFound: number): string {
  const head = enabled
    ? `${plural(updated, 'compte passé', 'comptes passés')} en mode recette`
    : `${plural(updated, 'compte retiré', 'comptes retirés')} du mode recette`
  const extras: string[] = []
  if (unchanged > 0) {
    extras.push(enabled
      ? `${plural(unchanged, 'déjà testeur', 'déjà testeurs')}`
      : `${plural(unchanged, 'n’était pas testeur', 'n’étaient pas testeurs')}`)
  }
  if (notFound > 0) extras.push(plural(notFound, 'introuvable', 'introuvables'))
  return extras.length ? `${head} (${extras.join(', ')}).` : `${head}.`
}

function failureMessage(e: unknown): string {
  const status = httpStatus(e)
  const code = problemCode(e)
  if (status === 409 || code === 'recette-disabled') {
    return 'Mode recette fermé dans cet environnement : aucun compte ne peut être désigné testeur.'
  }
  if (status === 403) return 'Action réservée au super-administrateur.'
  if (status === 422) return `Sélection refusée : choisissez entre 1 et ${RECETTE_BULK_MAX} utilisateurs.`
  return extractProblemMessage(e, 'Modification impossible, réessayez.')
}

export function useRecetteBulk() {
  const auth = useAuthStore()
  const available = ref(false)
  const selected = ref<Set<string>>(new Set())
  const busy = ref(false)
  const selectingAll = ref(false)
  /** La sélection « tous les résultats » a été plafonnée à RECETTE_BULK_MAX. */
  const truncated = ref(false)
  const feedback = ref<RecetteBulkFeedback | null>(null)
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null

  const count = computed(() => selected.value.size)
  const ids = computed(() => [...selected.value])

  function showFeedback(next: RecetteBulkFeedback) {
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedback.value = next
    feedbackTimer = setTimeout(() => { feedback.value = null; feedbackTimer = null }, FEEDBACK_MS)
  }

  async function load() {
    if (!auth.can('ADMIN_MANAGE')) { available.value = false; return }
    try {
      const status = await usersService.getRecetteStatus()
      available.value = status?.enabled === true
    } catch {
      // Back sans l'endpoint (PR jumelle pas encore déployée), droit retiré : on se tait.
      available.value = false
    }
  }

  function replace(next: Set<string>) { selected.value = next }

  function toggle(id: string) {
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    truncated.value = false
    replace(next)
  }

  /** Coche toute la page, ou la décoche si elle l'est déjà entièrement. */
  function togglePage(pageIds: string[]) {
    const next = new Set(selected.value)
    const allSelected = pageIds.length > 0 && pageIds.every((id) => next.has(id))
    for (const id of pageIds) {
      if (allSelected) next.delete(id)
      else next.add(id)
    }
    truncated.value = false
    replace(next)
  }

  function clear() {
    truncated.value = false
    replace(new Set())
  }

  /**
   * Sélectionne tous les résultats du filtre courant, au-delà de la page, dans la limite d'un
   * lot (RECETTE_BULK_MAX) : une seule requête de liste de cette taille.
   */
  async function selectAllMatching(filters: UsersFilterState) {
    if (selectingAll.value) return
    selectingAll.value = true
    try {
      const page = await usersService.list(filters, 0, RECETTE_BULK_MAX)
      replace(new Set(page.content.map((u) => u.id)))
      truncated.value = page.totalElements > RECETTE_BULK_MAX
    } catch (e) {
      showFeedback({ tone: 'error', text: extractProblemMessage(e, 'Impossible de charger tous les résultats.') })
    } finally {
      selectingAll.value = false
    }
  }

  /** Applique le mode à la sélection ; vide la sélection en cas de succès. */
  async function apply(enabled: boolean): Promise<boolean> {
    if (busy.value || count.value === 0) return false
    busy.value = true
    try {
      const r = await usersService.setRecetteTesterBulk(ids.value, enabled)
      showFeedback({
        tone: 'success',
        text: bulkSuccessMessage(enabled, r.updated, r.unchanged, r.notFound?.length ?? 0),
      })
      clear()
      return true
    } catch (e) {
      if (httpStatus(e) === 409 || problemCode(e) === 'recette-disabled') available.value = false
      showFeedback({ tone: 'error', text: failureMessage(e) })
      return false
    } finally {
      busy.value = false
    }
  }

  function dispose() {
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedbackTimer = null
  }

  return {
    available, selected, count, busy, selectingAll, truncated, feedback,
    load, toggle, togglePage, clear, selectAllMatching, apply, dispose,
  }
}
