import { computed, reactive, ref } from 'vue'
import { financeService } from '@/features/finance/services/financeService'
import { defaultMobileMoneyView, readMobileMoneyQuery, writeMobileMoneyQuery } from '@/features/finance/lib/mobileMoneyViews'
import type { AdminMobileMoneyPayment, MobileMoneyCounts, MobileMoneyOperationKind, MobileMoneyView } from '@/features/finance/types/index'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'

const PAGE_SIZE = 20

/** Les nombres ont la forme attendue (une réponse d'un autre endpoint, ou d'un vieux mock, ne passe pas). */
const isCounts = (v: unknown): v is MobileMoneyCounts => {
  const c = v as Partial<Record<keyof MobileMoneyCounts, unknown>> | null
  return !!c && ['failed', 'open', 'done', 'all', 'attention'].every(k => typeof c[k as keyof MobileMoneyCounts] === 'number')
}

/**
 * Liste des opérations mobile money de la page Transactions : vues à nombres (Échecs, En cours,
 * Réussies, Toutes), filtres Type / Opérateur / recherche, pagination.
 *
 * - Les nombres suivent `kind`, `provider` et `q`, jamais la vue.
 * - Vue d'ouverture : celle de l'URL ; sinon Échecs s'il y a de l'attention, sinon Toutes. Elle est
 *   décidée une seule fois, nombres reçus, et ne bouge plus si l'utilisateur a déjà choisi une vue.
 * - Ancien back (`counts` absent) : `unavailable`, vue « Toutes », aucun nombre, liste plate.
 * - Réponse périmée (deux requêtes qui se chevauchent) : la plus récente gagne.
 * - L'URL n'est pas écrite ici : la page la synchronise tant que la section est active
 *   (`applyUrl` / `syncFromQuery`), pour ne pas se mêler aux filtres des Paiements.
 */
export function useMobileMoney() {
  const rows = ref<AdminMobileMoneyPayment[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const filters = reactive<{ view: MobileMoneyView; kind: MobileMoneyOperationKind | ''; provider: string; query: string }>({
    view: 'ALL', kind: '', provider: '', query: '',
  })
  const counts = ref<MobileMoneyCounts | null>(null)
  const unavailable = ref(false)
  const countsError = ref<string | null>(null)
  const viewsReady = computed(() => counts.value !== null && !unavailable.value)
  /** Opérateurs rencontrés dans les listes chargées (cumulés) : la liste des opérateurs n'est pas figée. */
  const seen = ref<string[]>([])
  const providers = computed(() => [...seen.value].sort())

  let listSeq = 0
  let countsSeq = 0
  /** L'utilisateur (ou l'URL) a choisi une vue : le défaut ne s'applique plus. */
  let viewChosen = false

  const scope = () => ({ kind: filters.kind, provider: filters.provider, q: filters.query })

  async function fetchList() {
    const my = ++listSeq
    isLoading.value = true; error.value = null
    try {
      const res = await financeService.listMobileMoneyPayments({
        view: filters.view, ...scope(), page: currentPage.value, size: PAGE_SIZE,
      })
      if (my !== listSeq) return
      rows.value = res.content ?? []
      totalPages.value = res.totalPages ?? 0
      currentPage.value = res.number ?? currentPage.value
      for (const r of rows.value) if (r.provider && !seen.value.includes(r.provider)) seen.value.push(r.provider)
    } catch (e) {
      if (my !== listSeq) return
      // Jamais les lignes d'une autre vue sous un message d'erreur.
      rows.value = []; totalPages.value = 0
      error.value = extractProblemMessage(e, 'Impossible de charger les opérations mobile money')
    } finally {
      if (my === listSeq) isLoading.value = false
    }
  }

  /**
   * `initial` : premier chargement. Une erreur de nombres y laisse la liste plate « Toutes »
   * (l'URL `view=done` est alors remplacée par Toutes). Après le chargement, une erreur garde les
   * nombres précédents (périmés mais utilisables) : les onglets restent actifs, le message d'erreur
   * `countsError` propose de réessayer.
   */
  async function fetchCounts(initial = false) {
    const my = ++countsSeq
    countsError.value = null
    try {
      const res = await financeService.mobileMoneyCounts(scope())
      if (my !== countsSeq) return
      if (isCounts(res)) { counts.value = res; unavailable.value = false }
      else { counts.value = null; unavailable.value = true }
    } catch (e) {
      if (my !== countsSeq) return
      if (isEndpointMissing(e)) { counts.value = null; unavailable.value = true }
      else {
        if (initial) counts.value = null
        countsError.value = extractProblemMessage(e, 'Impossible de charger les nombres')
      }
    }
  }

  const refreshCounts = () => (unavailable.value ? Promise.resolve() : fetchCounts())

  function apply(state: ReturnType<typeof readMobileMoneyQuery>) {
    filters.kind = state.kind ?? ''
    filters.provider = state.provider ?? ''
    filters.query = state.query ?? ''
  }

  /** Premier chargement : filtres de l'URL, nombres, puis vue (URL, sinon défaut) et liste. */
  async function load(query: Record<string, unknown> = {}) {
    const state = readMobileMoneyQuery(query)
    apply(state)
    if (state.view) { filters.view = state.view; viewChosen = true }
    currentPage.value = 0
    await fetchCounts(true)
    // Sans nombres (ancien back, erreur) : pas de vues, liste plate « Toutes ».
    if (!viewsReady.value) filters.view = 'ALL'
    else if (!viewChosen) filters.view = defaultMobileMoneyView(counts.value)
    await fetchList()
  }

  async function reload() {
    await fetchCounts()
    if (!viewsReady.value) filters.view = 'ALL'
    await fetchList()
  }

  /** Query reçue page ouverte (lien, retour arrière) : appliquée seulement si elle diffère de l'état. */
  async function syncFromQuery(query: Record<string, unknown>) {
    const s = readMobileMoneyQuery(query)
    const view = viewsReady.value && s.view ? s.view : filters.view
    const next = { view, kind: s.kind ?? '', provider: s.provider ?? '', query: s.query ?? '' }
    const scopeChanged = next.kind !== filters.kind || next.provider !== filters.provider || next.query !== filters.query
    if (!scopeChanged && next.view === filters.view) return
    filters.view = next.view; apply(s); viewChosen = true
    currentPage.value = 0
    await Promise.all([fetchList(), scopeChanged ? refreshCounts() : null])
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchList() }
  async function setView(v: MobileMoneyView) {
    viewChosen = true
    filters.view = v; currentPage.value = 0
    await fetchList()
  }
  async function changeScope() {
    currentPage.value = 0
    await Promise.all([fetchList(), refreshCounts()])
  }
  async function setKind(k: MobileMoneyOperationKind | '') { filters.kind = k; await changeScope() }
  async function setProvider(p: string) { filters.provider = p; await changeScope() }
  async function setQuery(q: string) { filters.query = q.trim(); await changeScope() }

  /** `query` complétée des filtres courants (la vue seulement si les nombres existent). */
  function applyUrl(query: Record<string, unknown>) {
    return writeMobileMoneyQuery(query, filters, viewsReady.value)
  }

  return {
    rows, isLoading, error, totalPages, currentPage, filters, counts, countsError, unavailable, viewsReady, providers,
    load, reload, syncFromQuery, applyUrl, goToPage, setView, setKind, setProvider, setQuery,
  }
}
