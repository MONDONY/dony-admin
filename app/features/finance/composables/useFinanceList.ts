import { computed, reactive, ref, type Ref } from 'vue'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'
import { uuidParam } from '@/lib/safeInput'

export const FINANCE_PAGE_SIZE = 20
const MAX_LEN = 120

export interface FinanceListPage<R> { content?: R[]; totalPages?: number; number?: number }

/** Règle de lecture d'un filtre dans l'URL (paramètre = nom du filtre). */
export interface FinanceFilterSpec {
  /** Valeurs admises ; toute autre est ignorée. */
  allowed?: readonly string[]
  /** Identifiant : UUID seulement. */
  uuid?: boolean
  /** Le filtre suit les nombres des vues (recherche, personne) : le changer les relit. */
  scope?: boolean
}

export interface FinanceListOptions<R, F extends Record<string, string>, C> {
  /** Filtres et leur valeur par défaut (chaîne vide = pas de filtre), hors vue. */
  filters: F
  specs: Record<keyof F & string, FinanceFilterSpec>
  /**
   * Vues de la liste. `counts` : onglets seulement une fois les nombres reçus (ancien back : liste
   * plate, vue `all`) ; `static` : toujours affichées (les nombres ne décident que du défaut).
   */
  views?: { ids: readonly string[]; all: string; source: 'counts' | 'static' }
  counts?: {
    // eslint-disable-next-line no-unused-vars
    fetch: (filters: F) => Promise<unknown>
    is: (value: unknown) => value is C
    /** Vue d'ouverture, nombres reçus, si ni l'URL ni l'utilisateur n'en a choisi. */
    // eslint-disable-next-line no-unused-vars
    defaultView: (counts: C) => string
  }
  /** Vues `static` : vue d'ouverture décidée une fois après le chargement (ex. tickets en attente). */
  initialView?: () => Promise<string>
  // eslint-disable-next-line no-unused-vars
  fetch: (filters: F & { view: string }, page: number) => Promise<FinanceListPage<R>>
  /** Lignes ouvrables par `?open=<id>` (mise en évidence). */
  // eslint-disable-next-line no-unused-vars
  rowId?: (row: R) => string
  errorLabel: string
}

function first(v: unknown): string | undefined {
  const raw = Array.isArray(v) ? v[0] : v
  return typeof raw === 'string' ? raw : undefined
}

/**
 * Liste finance de la page Transactions (portefeuilles, commissions cash, remboursements wallet,
 * litiges bancaires) : filtres et vues lus et écrits dans l'URL par la page, nombres par vue,
 * ligne ouverte par `?open=`, pagination.
 *
 * - Vue d'ouverture : celle de l'URL ; une ligne ouverte sans vue = vue « tout » (pour qu'elle soit
 *   dans la liste) ; sinon le défaut, décidé une fois et jamais par-dessus un choix.
 * - Nombres absents (404/405 sans `code`, forme inattendue) : `unavailable`, pas de vues, jamais de
 *   « 0 » inventé. Erreur au chargement : liste « tout » + `countsError` ; plus tard : les nombres
 *   précédents restent, `countsError` propose de réessayer.
 * - Réponses périmées (requêtes qui se chevauchent) : la plus récente gagne, liste et nombres.
 * - Une liste en échec n'a aucune ligne et porte son `error` : jamais un faux « aucun résultat ».
 * - L'URL n'est pas écrite ici : `applyUrl` / `syncFromQuery` servent la page, seulement tant que
 *   l'onglet est affiché (`useTransactionTabs`).
 */
export function useFinanceList<R, F extends Record<string, string>, C = never>(o: FinanceListOptions<R, F, C>) {
  const all = o.views?.all ?? 'ALL'
  const rows = ref([]) as Ref<R[]>
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(0)
  const filters = reactive({ ...o.filters, view: all }) as F & { view: string }
  const counts = ref(null) as Ref<C | null>
  const unavailable = ref(false)
  const countsError = ref<string | null>(null)
  const openId = ref<string | null>(null)
  const viewsReady = computed(() => o.views?.source === 'static'
    || (o.views?.source === 'counts' && counts.value !== null && !unavailable.value))
  /** Ligne demandée par lien mais absente de la page chargée (autre page, filtre) : à signaler. */
  const openMissing = computed(() => !!openId.value && !isLoading.value && !error.value && !!o.rowId
    && !rows.value.some(r => o.rowId!(r) === openId.value))

  const keys = Object.keys(o.specs) as (keyof F & string)[]
  const scopeKeys = keys.filter(k => o.specs[k].scope)
  /** Paramètres d'URL de la liste : à retirer de l'URL quand on quitte son onglet. */
  const params: string[] = [...keys, ...(o.views ? ['view'] : []), ...(o.rowId ? ['open'] : [])]

  let listSeq = 0
  let countsSeq = 0
  let viewChosen = false

  async function fetchList() {
    const my = ++listSeq
    isLoading.value = true; error.value = null
    try {
      const res = await o.fetch({ ...filters, view: viewsReady.value ? filters.view : all }, currentPage.value)
      if (my !== listSeq) return
      rows.value = res.content ?? []
      totalPages.value = res.totalPages ?? 0
      currentPage.value = res.number ?? currentPage.value
    } catch (e) {
      if (my !== listSeq) return
      rows.value = []; totalPages.value = 0
      error.value = extractProblemMessage(e, o.errorLabel)
    } finally {
      if (my === listSeq) isLoading.value = false
    }
  }

  async function fetchCounts(initial = false) {
    if (!o.counts) return
    const my = ++countsSeq
    countsError.value = null
    try {
      const res = await o.counts.fetch({ ...filters })
      if (my !== countsSeq) return
      if (o.counts.is(res)) { counts.value = res; unavailable.value = false }
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

  /** Filtres, vue et ligne ouverte lus dans une query ; valeurs inconnues ou mal formées ignorées. */
  function read(query: Record<string, unknown> | undefined) {
    const q = query ?? {}
    const values = {} as Record<string, string>
    for (const k of keys) {
      const spec = o.specs[k]
      const raw = first(q[k])?.trim() ?? ''
      const ok = raw.length <= MAX_LEN && (!spec.allowed || spec.allowed.includes(raw)) && (!spec.uuid || uuidParam(raw) !== null)
      values[k] = ok ? raw : ''
    }
    const rawView = first(q.view)?.toLowerCase()
    const view = o.views?.ids.find(id => id.toLowerCase() === rawView) ?? null
    const open = o.rowId ? uuidParam(first(q.open)) : null
    return { values, view, open }
  }

  /** Premier chargement : filtres de l'URL, nombres, puis vue (URL, ligne ouverte, défaut) et liste. */
  async function load(query: Record<string, unknown> = {}) {
    const s = read(query)
    Object.assign(filters, s.values)
    openId.value = s.open
    if (s.view) { filters.view = s.view; viewChosen = true }
    else if (s.open) { filters.view = all; viewChosen = true }
    currentPage.value = 0
    await fetchCounts(true)
    if (o.views?.source === 'counts') {
      if (!viewsReady.value) filters.view = all
      else if (!viewChosen) filters.view = o.counts!.defaultView(counts.value as C)
    } else if (o.views && !viewChosen && o.initialView) {
      const v = await o.initialView()
      if (!viewChosen) filters.view = v
    }
    await fetchList()
  }

  async function reload() {
    await fetchCounts()
    if (o.views?.source === 'counts' && !viewsReady.value) filters.view = all
    await fetchList()
  }

  /**
   * Query reçue page ouverte (lien, retour arrière) : appliquée seulement si elle change quelque
   * chose. Sans `view`, la vue courante reste, sauf une nouvelle ligne ouverte (vue « tout »).
   */
  async function syncFromQuery(query: Record<string, unknown>) {
    const s = read(query)
    const newOpen = s.open !== null && s.open !== openId.value
    const view = !viewsReady.value ? filters.view : (s.view ?? (newOpen ? all : filters.view))
    const scopeChanged = keys.some(k => s.values[k] !== filters[k])
    const countsChanged = scopeKeys.some(k => s.values[k] !== filters[k])
    const viewChanged = view !== filters.view
    if (!scopeChanged && !viewChanged && s.open === openId.value) return
    Object.assign(filters, s.values)
    openId.value = s.open
    if (viewChanged) { filters.view = view; viewChosen = true }
    if (!scopeChanged && !viewChanged) return
    currentPage.value = 0
    await Promise.all([fetchList(), countsChanged ? refreshCounts() : null])
  }

  /** `query` complétée de l'état : filtres non vides, vue hors « tout » (si les vues existent), ligne ouverte. */
  function applyUrl(query: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = { ...query }
    for (const p of params) delete next[p]
    for (const k of keys) if (filters[k]) next[k] = filters[k]
    if (o.views && viewsReady.value && filters.view !== all) next.view = filters.view.toLowerCase()
    if (openId.value) next.open = openId.value
    return next
  }

  async function goToPage(p: number) { currentPage.value = p; await fetchList() }
  /** Choix d'une vue : il gagne sur le défaut, et referme la ligne ouverte par lien. */
  async function setView(v: string) {
    if (v === filters.view) return
    viewChosen = true
    openId.value = null
    filters.view = v; currentPage.value = 0
    await fetchList()
  }
  async function setFilter(key: keyof F & string, value: string) {
    const v = value.trim()
    if (v === filters[key]) return
    ;(filters as Record<string, string>)[key] = v
    openId.value = null
    currentPage.value = 0
    await Promise.all([fetchList(), o.specs[key].scope ? refreshCounts() : null])
  }

  return {
    rows, isLoading, error, totalPages, currentPage, filters, counts, countsError, unavailable, viewsReady,
    openId, openMissing, params,
    load, reload, syncFromQuery, applyUrl, goToPage, setView, setFilter,
  }
}
