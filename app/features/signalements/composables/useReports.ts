import { computed, reactive, ref } from 'vue'
import { reportsService } from '@/features/signalements/services/reportsService'
import type { AdminReport, BulkRestoreResult, ReportAction, ReportsFilterState, ReportStatusFilter, ReportTargetType } from '@/features/signalements/types/index'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { reasonViolationMessage } from '@/lib/restoreReason'

/** Plafond de POST /admin/reports/bulk-restore. */
const BULK_RESTORE_MAX = 100

export function useReports() {
  const reports = ref<AdminReport[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const totalElements = ref(0)
  const currentPage = ref(0)
  const pageSize = ref(20)
  const filters = reactive<ReportsFilterState>({ status: 'OPEN', targetType: null, q: '', deleted: false })
  /**
   * Un ancien back ignore `deleted=true` et renvoie les signalements ACTIFS, sans `deletedAt` :
   * les montrer sous « Supprimés » ferait croire qu'ils le sont. On vide alors la liste.
   */
  const deletedFilterUnsupported = ref(false)
  /** Endpoints de restauration absents (404/405 sans code) : l'action est masquée. */
  const restoreUnavailable = ref(false)
  /** Motif refusé par la validation du back (422 `violations`) : affiché dans le dialogue. */
  const reasonError = ref<string | null>(null)

  // ---- Sélection (modèle Gmail) ----
  // `selectedIds` : les lignes cochées sur la page courante. `allResultsSelected` :
  // l'utilisateur a demandé « tous les résultats », toutes pages comprises ; la
  // suppression passe alors par le filtre courant, pas par les identifiants.
  const selectedIds = ref<string[]>([])
  const allResultsSelected = ref(false)
  const selectedCount = computed(() => (allResultsSelected.value ? totalElements.value : selectedIds.value.length))
  const pageFullySelected = computed(() =>
    reports.value.length > 0 && reports.value.every((r) => selectedIds.value.includes(r.id)))
  // Proposer « sélectionner les N résultats » seulement quand la page est entière et
  // qu'il reste des résultats hors de la page.
  // Jamais sous « Supprimés » : la restauration groupée ne prend que des identifiants.
  const canSelectAllResults = computed(() =>
    !filters.deleted && pageFullySelected.value && !allResultsSelected.value && totalElements.value > reports.value.length)

  function clearSelection() {
    selectedIds.value = []
    allResultsSelected.value = false
  }
  function toggleSelect(id: string) {
    allResultsSelected.value = false
    selectedIds.value = selectedIds.value.includes(id)
      ? selectedIds.value.filter((x) => x !== id)
      : [...selectedIds.value, id]
  }
  function togglePage() {
    allResultsSelected.value = false
    selectedIds.value = pageFullySelected.value ? [] : reports.value.map((r) => r.id)
  }
  function selectAllResults() {
    selectedIds.value = reports.value.map((r) => r.id)
    allResultsSelected.value = true
  }

  async function fetchReports() {
    isLoading.value = true
    error.value = null
    try {
      const page = await reportsService.list(filters, currentPage.value, pageSize.value)
      deletedFilterUnsupported.value = Boolean(filters.deleted) && page.content.length > 0
        && page.content.every((r) => !r.deletedAt)
      const unsupported = deletedFilterUnsupported.value
      reports.value = unsupported ? [] : page.content
      totalPages.value = unsupported ? 0 : page.totalPages
      totalElements.value = unsupported ? 0 : page.totalElements
    } catch (e) {
      error.value = extractProblemMessage(e, 'Impossible de charger les signalements')
    } finally {
      isLoading.value = false
    }
  }

  // Tout changement de page ou de filtre repart d'une sélection vide : une sélection
  // qui survivrait à un changement de filtre supprimerait des lignes que l'écran ne
  // montre plus.
  async function goToPage(p: number) { currentPage.value = p; clearSelection(); await fetchReports() }
  async function setStatusFilter(s: ReportStatusFilter) { filters.status = s; currentPage.value = 0; clearSelection(); await fetchReports() }
  async function setTargetTypeFilter(t: ReportTargetType | null) { filters.targetType = t; currentPage.value = 0; clearSelection(); await fetchReports() }
  async function setQuery(q: string) {
    const next = q.trim()
    if (next === filters.q) return
    filters.q = next
    currentPage.value = 0
    clearSelection()
    await fetchReports()
  }
  async function setDeletedFilter(d: boolean) { filters.deleted = d; currentPage.value = 0; clearSelection(); await fetchReports() }
  async function resolve(id: string, action: ReportAction, note: string) {
    await reportsService.resolve(id, action, note)
    await fetchReports()
  }

  /** Supprime un signalement, puis recharge la page. */
  async function deleteOne(id: string) {
    await reportsService.remove(id)
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
    await fetchReports()
  }

  /**
   * Supprime la sélection : par identifiants, ou tous les résultats du filtre courant
   * quand « tous les résultats » a été demandé. Rend le nombre supprimé.
   */
  async function deleteSelected(): Promise<number> {
    if (selectedCount.value === 0) return 0
    const { deleted } = allResultsSelected.value
      ? await reportsService.bulkDelete({ all: true, filters })
      : await reportsService.bulkDelete({ ids: selectedIds.value })
    clearSelection()
    // Une page vidée renvoie sur la précédente plutôt que sur une page blanche.
    if (currentPage.value > 0 && deleted >= reports.value.length) currentPage.value -= 1
    await fetchReports()
    return deleted
  }

  /** Rend true si le signalement est restauré ; sinon `error` porte le refus (409 compris). */
  async function restoreOne(id: string, reason: string): Promise<boolean> {
    error.value = null
    reasonError.value = null
    try {
      await reportsService.restore(id, reason)
    } catch (e) {
      if (isEndpointMissing(e)) { restoreUnavailable.value = true; return false }
      const invalid = reasonViolationMessage(e)
      if (invalid) { reasonError.value = invalid; return false }
      const message = extractProblemMessage(e, 'Impossible de restaurer ce signalement')
      // Un 409 dit que la liste est périmée (déjà restauré ailleurs) : on la relit, puis on
      // pose le refus (la relecture remet `error` à zéro).
      await fetchReports()
      error.value = message
      return false
    }
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
    await fetchReports()
    return true
  }

  /** Restaure la sélection (100 au plus) ; null si rien n'est parti. */
  async function restoreSelected(): Promise<BulkRestoreResult | null> {
    if (selectedIds.value.length === 0) return null
    error.value = null
    let result: BulkRestoreResult
    try {
      result = await reportsService.bulkRestore(selectedIds.value.slice(0, BULK_RESTORE_MAX))
    } catch (e) {
      if (isEndpointMissing(e)) restoreUnavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible de restaurer la sélection')
      return null
    }
    clearSelection()
    if (currentPage.value > 0 && result.restored >= reports.value.length) currentPage.value -= 1
    await fetchReports()
    return result
  }

  return {
    deletedFilterUnsupported, restoreUnavailable, reasonError, setDeletedFilter, restoreOne, restoreSelected,
    reports, isLoading, error, totalPages, totalElements, currentPage, pageSize, filters,
    selectedIds, allResultsSelected, selectedCount, pageFullySelected, canSelectAllResults,
    fetchReports, goToPage, setStatusFilter, setTargetTypeFilter, setQuery, resolve,
    toggleSelect, togglePage, selectAllResults, clearSelection, deleteOne, deleteSelected,
  }
}
