import { reactive, ref } from 'vue'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import type {
  AdminNoShow, NoShowDecision, NoShowDecisionResult, NoShowFilters, NoShowScopeFilter, NoShowStatusFilter,
} from '@/features/incidents/types/index'
import { decisionSuccess, disputePending } from '@/features/incidents/components/noShowLabels'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isEndpointMissing, problemCode } from '@/lib/endpointMissing'

const ALREADY_DECIDED = 'noshow-already-decided'
const NOT_FOUND = 'noshow-not-found'
/** Le litige d'une absence confirmée à l'arrivée est créé après la réponse : on relit un peu plus tard. */
export const DISPUTE_REFRESH_MS = 1000

function httpStatus(e: unknown): number | undefined {
  const err = e as { statusCode?: number; status?: number; response?: { status?: number } } | undefined
  return err?.statusCode ?? err?.status ?? err?.response?.status
}

/** Messages de validation du back : objet `champ → message` (contrat) ou liste `{ message }`. */
function violationsMessage(e: unknown): string | null {
  const v = (e as { data?: { violations?: unknown } } | undefined)?.data?.violations
  if (!v || typeof v !== 'object') return null
  const messages = Array.isArray(v)
    ? v.map((x) => (x as { message?: unknown })?.message)
    : Object.values(v as Record<string, unknown>)
  const texts = messages.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
  return texts.length ? texts.join(' ') : null
}

function decisionErrorMessage(e: unknown): string {
  if (problemCode(e) === ALREADY_DECIDED) return 'Cette déclaration a déjà été tranchée par un autre administrateur. La liste a été rechargée.'
  if (problemCode(e) === NOT_FOUND) return 'Cette déclaration n’existe plus. La liste a été rechargée.'
  const status = httpStatus(e)
  if (status === 422) return violationsMessage(e) ?? extractProblemMessage(e, 'Le motif est invalide.')
  if (isEndpointMissing(e)) return 'Action indisponible : le serveur n’est pas encore à jour.'
  if (status === 403) return 'Vous n’avez pas la permission de trancher ce no-show.'
  return extractProblemMessage(e, 'La décision n’a pas pu être enregistrée.')
}

export function useNoShows() {
  const rows = ref<AdminNoShow[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<NoShowFilters>({ status: 'PENDING_CONFIRMATION', scope: 'ALL' })
  const currentPage = ref(0)
  const totalPages = ref(0)
  const pageSize = 20
  const selected = ref<AdminNoShow | null>(null)
  const openError = ref<string | null>(null)
  const success = ref<string | null>(null)

  /** La page courante ne change qu'une fois la nouvelle page reçue : un échec laisse l'ancienne affichée. */
  async function fetch(page = currentPage.value) {
    isLoading.value = true; error.value = null
    try {
      const res = await incidentsService.listNoShows({ ...filters }, page, pageSize)
      rows.value = res.content
      totalPages.value = res.totalPages
      currentPage.value = page
    } catch (e) {
      error.value = problemCode(e) === 'invalid-noshow-filter'
        ? 'Ce filtre n’est pas reconnu par le serveur : choisissez « Tous ».'
        : extractProblemMessage(e, 'Impossible de charger les no-shows')
    } finally { isLoading.value = false }
  }
  const goToPage = (page: number) => fetch(page)
  async function setStatus(s: NoShowStatusFilter) { filters.status = s; await fetch(0) }
  async function setScope(s: NoShowScopeFilter) { filters.scope = s; await fetch(0) }

  function select(row: AdminNoShow) { selected.value = row; openError.value = null; success.value = null }
  function close() { selected.value = null }

  /**
   * Lien profond `?open=<id>` : pas d'endpoint de détail, on cherche dans la page chargée,
   * puis dans la première page tous filtres confondus.
   */
  async function openById(id: string): Promise<boolean> {
    openError.value = null
    let row = rows.value.find((r) => r.id === id)
    if (!row && (filters.status !== 'ALL' || filters.scope !== 'ALL')) {
      filters.status = 'ALL'; filters.scope = 'ALL'
      await fetch(0)
      row = rows.value.find((r) => r.id === id)
    }
    if (!row) { openError.value = 'Déclaration introuvable dans la liste : elle a peut-être été tranchée, utilisez les filtres.'; return false }
    select(row)
    return true
  }

  function replaceSelected(id: string, next: AdminNoShow) {
    if (selected.value?.id === id) selected.value = next
  }

  async function refreshAfterDispute(updated: AdminNoShow) {
    await fetch()
    const reread = rows.value.find((r) => r.id === updated.id)
    if (reread) replaceSelected(updated.id, reread)
  }

  async function decide(row: AdminNoShow, decision: NoShowDecision, reason: string): Promise<NoShowDecisionResult> {
    success.value = null
    if (row.legacy && decision === 'reject') {
      return { ok: false, code: null, message: 'Le rejet n’est pas disponible tant que le serveur n’est pas à jour.' }
    }
    const motif = reason.trim()
    try {
      if (row.legacy) {
        await incidentsService.confirmLegacyNoShow(row.bidId)
        await fetch()
        replaceSelected(row.id, rows.value.find((r) => r.id === row.id) ?? { ...row, status: 'CONFIRMED', canConfirm: false, canReject: false })
      } else {
        const updated = decision === 'confirm'
          ? await incidentsService.confirmNoShow(row.id, motif)
          : await incidentsService.rejectNoShow(row.id, motif)
        replaceSelected(row.id, updated)
        await fetch()
        if (disputePending(updated)) {
          const message = decisionSuccess(row, decision, true)
          success.value = message
          setTimeout(() => { void refreshAfterDispute(updated) }, DISPUTE_REFRESH_MS)
          return { ok: true, message, disputePending: true }
        }
      }
      const message = decisionSuccess(row, decision)
      success.value = message
      return { ok: true, message }
    } catch (e) {
      const code = problemCode(e)
      if (code === ALREADY_DECIDED || code === NOT_FOUND) {
        await fetch()
        replaceSelected(row.id, rows.value.find((r) => r.id === row.id) ?? { ...row, canConfirm: false, canReject: false })
      }
      return { ok: false, code, message: decisionErrorMessage(e) }
    }
  }
  const confirm = (row: AdminNoShow, reason: string) => decide(row, 'confirm', reason)
  const reject = (row: AdminNoShow, reason: string) => decide(row, 'reject', reason)

  return {
    rows, isLoading, error, filters, currentPage, totalPages, pageSize, selected, openError, success,
    fetch, goToPage, setStatus, setScope, select, close, openById, decide, confirm, reject,
  }
}
