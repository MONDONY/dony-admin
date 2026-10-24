import { computed, reactive, ref, watch } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { sameQuery } from '@/lib/urlFilters'
import { isTab, sectionOf, type TransactionTab } from '@/features/transactions/lib/sections'

type Query = Record<string, unknown>

/** Ce que la page attend d'une liste dont les filtres vivent dans l'URL de son onglet. */
export interface ScopedList {
  /** Paramètres d'URL de la liste : ils n'existent que tant que son onglet est affiché. */
  params: readonly string[]
  // eslint-disable-next-line no-unused-vars
  load: (query: Query) => Promise<void>
  // eslint-disable-next-line no-unused-vars
  syncFromQuery: (query: Query) => Promise<void>
  // eslint-disable-next-line no-unused-vars
  applyUrl: (query: Query) => Query
}

export interface TransactionTabsOptions {
  /** Query d'un changement d'onglet côté tiroir paiement (`open`/`section` retirés, `tab` posé). */
  // eslint-disable-next-line no-unused-vars
  tabQuery: (tab: TransactionTab) => Query
  /** Filtres des Paiements réécrits depuis leur état. */
  // eslint-disable-next-line no-unused-vars
  applyPayments: (query: Query) => Query
  /** Paramètres d'URL des Paiements (alias `held` compris). */
  paymentParams: readonly string[]
  /** Listes dont les filtres vivent dans l'URL, par onglet. */
  lists: Partial<Record<TransactionTab, ScopedList>>
  /** Chargement d'un onglet sans paramètre d'URL (Commissions mobile money), à chaque visite. */
  visit?: Partial<Record<TransactionTab, () => Promise<unknown>>>
}

const copyQuery = (route: { query?: Query } | undefined): Query => ({ ...((route?.query ?? {}) as Query) })

/**
 * Onglet de la page Transactions (`?tab=`, les sept identifiants historiques) et portée des
 * paramètres d'URL : chaque section ou sous-onglet possède les siens (Paiements : vue, alerte,
 * recherche… ; Mobile money : vue, type, opérateur ; Portefeuilles : recherche, devise, signe,
 * titulaire ; Litiges : vue, recherche, ligne ouverte…), écrits seulement tant que son onglet est
 * affiché et retirés quand on le quitte. `tab` est toujours gardé ; les autres paramètres inconnus
 * aussi. Revenir sur un onglet réécrit ses paramètres depuis son état (gardé en mémoire).
 *
 * Un lien reçu (au chargement, ou page déjà ouverte quand seule la query change) ouvre l'onglet et
 * applique ses paramètres. `open` désigne le paiement du tiroir sur Paiements (`usePaymentDrawerRoute`),
 * une ligne de la liste ailleurs (litige bancaire, demande de remboursement wallet).
 */
export function useTransactionTabs(o: TransactionTabsOptions) {
  const route = useRoute()
  const router = useRouter()
  const initial = route?.query?.tab
  const tab = ref<TransactionTab>(isTab(initial) ? initial : 'payments')
  const section = computed(() => sectionOf(tab.value))
  const visited = reactive(new Set<TransactionTab>())
  const listOf = (t: TransactionTab) => o.lists[t]

  /** Paramètres possédés par une section : jamais emportés dans une autre. `open` est traité à part. */
  const scoped = new Set<string>([...o.paymentParams, ...Object.values(o.lists).flatMap(l => l?.params ?? [])])
  scoped.delete('open')

  /** Query de l'onglet `t`, ses seuls paramètres écrits depuis son état. */
  function queryForTab(t: TransactionTab): Query {
    const query = { ...o.tabQuery(t) }
    for (const k of scoped) delete query[k]
    if (t === 'payments') return o.applyPayments(query)
    return listOf(t)?.applyUrl(query) ?? query
  }

  async function switchTab(t: TransactionTab, fromUrl = false) {
    tab.value = t
    if (!fromUrl) {
      const query = queryForTab(t)
      if (query.tab !== route?.query?.tab) void router.replace({ query: query as LocationQueryRaw })
    }
    const list = listOf(t)
    if (list) {
      // Première visite : les filtres de l'URL si le lien les porte ; sinon les défauts de la liste.
      if (!visited.has(t)) { visited.add(t); await list.load(fromUrl ? copyQuery(route) : {}) }
      else if (fromUrl) await list.syncFromQuery(copyQuery(route))
    }
    else await o.visit?.[t]?.()
  }

  /** Au montage : l'onglet du lien reçu (Paiements se charge à part). */
  function start(): Promise<void> {
    return tab.value === 'payments' ? Promise.resolve() : switchTab(tab.value, true)
  }

  // Lien reçu page ouverte (notification, recherche globale) : seul `tab` change.
  watch(() => route?.query?.tab, (v) => {
    const t: TransactionTab = isTab(v) ? v : 'payments'
    if (t !== tab.value) void switchTab(t, true)
  })
  // … ou seulement les paramètres de l'onglet affiché (lien vers un autre titulaire, retour arrière).
  watch(
    () => [tab.value, JSON.stringify((listOf(tab.value)?.params ?? []).map(k => route?.query?.[k] ?? null))] as const,
    ([t], [previous]) => {
      if (t !== previous) return
      const list = listOf(t)
      if (list && visited.has(t)) void list.syncFromQuery(copyQuery(route))
    },
  )
  // État de la liste affichée → URL (vue par défaut décidée, filtre, page de résultats…).
  watch(
    () => (Object.keys(o.lists) as TransactionTab[]).map(t => (visited.has(t) ? JSON.stringify(listOf(t)!.applyUrl({})) : '')),
    () => {
      const t = tab.value
      const list = listOf(t)
      if (!list || !visited.has(t)) return
      const base = copyQuery(route)
      for (const k of [...scoped, 'open', 'section']) delete base[k]
      base.tab = t
      const next = list.applyUrl(base)
      if (!sameQuery(route?.query as Query | undefined, next)) void router.replace({ query: next as LocationQueryRaw })
    },
  )

  return { tab, section, switchTab, start }
}
