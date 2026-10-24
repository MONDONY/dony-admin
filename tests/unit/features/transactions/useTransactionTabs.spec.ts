/**
 * Onglet de la page Transactions dans l'URL et portée des paramètres : chaque liste n'écrit que
 * les siens tant que son onglet est affiché, et ils disparaissent quand on la quitte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { TransactionTab } from '@/features/transactions/lib/sections'

const route = reactive({ query: {} as Record<string, unknown> })
const replace = vi.fn(async (to: { query: Record<string, unknown> }) => { route.query = to.query })
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => ({ replace }))

import { useTransactionTabs, type ScopedList } from '@/features/transactions/composables/useTransactionTabs'

/** Fausse liste : un filtre `q` (paramètre `query`) et une `view`, réécrits par `applyUrl`. */
function fakeList(params: string[] = ['query', 'view']): ScopedList & { state: Record<string, string> } {
  const state = reactive<Record<string, string>>({})
  return {
    state,
    params,
    load: vi.fn(async (q: Record<string, unknown>) => { for (const k of params) if (typeof q[k] === 'string') state[k] = q[k] as string }),
    syncFromQuery: vi.fn(async (q: Record<string, unknown>) => { for (const k of params) state[k] = typeof q[k] === 'string' ? q[k] as string : '' }),
    applyUrl: (q: Record<string, unknown>) => {
      const next = { ...q }
      for (const k of params) { delete next[k]; if (state[k]) next[k] = state[k] }
      return next
    },
  }
}

const PAYMENT_PARAMS = ['status', 'query', 'view', 'partyId', 'held']
let scope: ReturnType<typeof effectScope>
function make(query: Record<string, unknown>, lists: Partial<Record<TransactionTab, ScopedList>>, extra: { visit?: Partial<Record<TransactionTab, () => Promise<unknown>>> } = {}) {
  route.query = query
  const pay = reactive<Record<string, string>>({ view: 'ESCROW' })
  scope = effectScope()
  const tabs = scope.run(() => useTransactionTabs({
    // Comme le tiroir : `open`/`section` retirés, `tab` posé hors Paiements.
    tabQuery: (t) => {
      const q = { ...route.query }
      delete q.open; delete q.section
      if (t === 'payments') delete q.tab
      else q.tab = t
      return q
    },
    applyPayments: q => ({ ...q, ...pay }),
    paymentParams: PAYMENT_PARAMS,
    lists,
    visit: extra.visit,
  }))!
  return { tabs, pay }
}

describe('useTransactionTabs', () => {
  beforeEach(() => { replace.mockClear() })
  afterEach(() => scope?.stop())

  it('onglet initial lu dans l’URL ; inconnu ou absent : Paiements', () => {
    expect(make({ tab: 'wallets' }, {}).tabs.tab.value).toBe('wallets')
    expect(make({ tab: 'pirate' }, {}).tabs.tab.value).toBe('payments')
    expect(make({}, {}).tabs.tab.value).toBe('payments')
  })

  it('start : la liste de l’onglet du lien est chargée avec la query reçue', async () => {
    const wallets = fakeList(['partyId'])
    const { tabs } = make({ tab: 'wallets', partyId: 'u1' }, { wallets })
    await tabs.start()
    expect(wallets.load).toHaveBeenCalledWith({ tab: 'wallets', partyId: 'u1' })
    expect(tabs.section.value).toBe('wallets')
  })

  it('Paiements → Soldes : les paramètres des Paiements ne suivent pas ; Soldes → Paiements : ils reviennent de l’état', async () => {
    const wallets = fakeList(['partyId'])
    const { tabs } = make({ view: 'ESCROW', query: 'awa', status: 'ESCROW', open: 'p1', section: 'money', other: 'x' }, { wallets })
    await tabs.switchTab('wallets')
    expect(replace).toHaveBeenLastCalledWith({ query: { tab: 'wallets', other: 'x' } })
    expect(wallets.load).toHaveBeenCalledWith({})
    await tabs.switchTab('payments')
    expect(replace).toHaveBeenLastCalledWith({ query: { other: 'x', view: 'ESCROW' } })
  })

  it('entre deux listes : les paramètres de l’une ne fuient pas dans l’autre', async () => {
    const cbs = fakeList(['query', 'view', 'open'])
    const cash = fakeList(['query', 'view', 'partyId'])
    const { tabs } = make({ tab: 'chargebacks', view: 'won', query: 'dakar', open: 'cb1' }, { chargebacks: cbs, 'cash-commissions': cash })
    await tabs.start()
    await tabs.switchTab('cash-commissions')
    expect(replace).toHaveBeenLastCalledWith({ query: { tab: 'cash-commissions' } })
    await tabs.switchTab('chargebacks')
    // L'état de la liste quittée est gardé : revenir réécrit ses paramètres.
    expect(replace).toHaveBeenLastCalledWith({ query: { tab: 'chargebacks', view: 'won', query: 'dakar', open: 'cb1' } })
    expect(cbs.load).toHaveBeenCalledTimes(1)
  })

  it('un changement d’état de la liste active s’écrit dans l’URL (avec tab), pas celui d’une liste cachée', async () => {
    const wallets = fakeList(['partyId'])
    const cash = fakeList(['partyId'])
    const { tabs } = make({ tab: 'wallets' }, { wallets, 'cash-commissions': cash })
    await tabs.start()
    wallets.state.partyId = 'u9'
    await nextTick()
    expect(replace).toHaveBeenLastCalledWith({ query: { tab: 'wallets', partyId: 'u9' } })
    replace.mockClear()
    cash.state.partyId = 'u2'
    await nextTick()
    expect(replace).not.toHaveBeenCalled()
  })

  it('l’URL d’une liste active ne garde ni les paramètres étrangers ni un `open` de paiement', async () => {
    const wallets = fakeList(['partyId'])
    const { tabs } = make({ tab: 'wallets', status: 'ESCROW', open: 'p1', section: 'money', keep: '1' }, { wallets })
    await tabs.start()
    wallets.state.partyId = 'u3'
    await nextTick()
    expect(replace).toHaveBeenLastCalledWith({ query: { tab: 'wallets', keep: '1', partyId: 'u3' } })
  })

  it('page ouverte : un lien qui ne change que les paramètres de l’onglet actif est appliqué', async () => {
    const cbs = fakeList(['query', 'view', 'open'])
    const { tabs } = make({ tab: 'chargebacks' }, { chargebacks: cbs })
    await tabs.start()
    route.query = { tab: 'chargebacks', open: 'cb2' }
    await flushPromises()
    expect(cbs.syncFromQuery).toHaveBeenCalledWith({ tab: 'chargebacks', open: 'cb2' })
  })

  it('page ouverte : un lien vers un autre onglet le charge avec ses paramètres (une seule fois)', async () => {
    const wallets = fakeList(['partyId'])
    const { tabs } = make({}, { wallets })
    route.query = { tab: 'wallets', partyId: 'u5' }
    await flushPromises()
    expect(tabs.tab.value).toBe('wallets')
    expect(wallets.load).toHaveBeenCalledWith({ tab: 'wallets', partyId: 'u5' })
    expect(wallets.syncFromQuery).not.toHaveBeenCalled()
    route.query = {}
    await flushPromises()
    expect(tabs.tab.value).toBe('payments')
    route.query = { tab: 'wallets', partyId: 'u6' }
    await flushPromises()
    expect(wallets.load).toHaveBeenCalledTimes(1)
    expect(wallets.syncFromQuery).toHaveBeenCalledWith({ tab: 'wallets', partyId: 'u6' })
  })

  it('un clic sur l’onglet déjà dans l’URL n’écrit rien ; un onglet sans liste appelle son chargement', async () => {
    const visit = vi.fn(async () => {})
    const { tabs } = make({ tab: 'mm-commissions' }, {}, { visit: { 'mm-commissions': visit } })
    await tabs.start()
    expect(visit).toHaveBeenCalledTimes(1)
    await tabs.switchTab('mm-commissions')
    expect(replace).not.toHaveBeenCalled()
  })

  it('start sur Paiements : rien à charger', async () => {
    const wallets = fakeList(['partyId'])
    const { tabs } = make({ tab: 'payments' }, { wallets })
    await tabs.start()
    expect(wallets.load).not.toHaveBeenCalled()
    expect(tabs.tab.value).toBe('payments')
  })
})

describe('useTransactionTabs : écriture de l’URL pendant une navigation en cours', () => {
  afterEach(() => scope?.stop())

  it('deux états successifs avant la fin du premier router.replace : le dernier état gagne (lien ?view=failed)', async () => {
    // Le routeur n'applique la query qu'à la résolution : tant qu'elle est en cours, `route.query` est l'ancienne.
    const resolvers: (() => void)[] = []
    replace.mockReset().mockImplementation((to: { query: Record<string, unknown> }) => new Promise<void>((r) => {
      resolvers.push(() => { route.query = to.query; r() })
    }))
    const list = fakeList(['view'])
    let releaseLoad!: () => void
    list.load = vi.fn(() => new Promise<void>((r) => { releaseLoad = r }))
    const { tabs } = make({ tab: 'mobile-money', view: 'failed' }, { 'mobile-money': list })
    void tabs.start()
    await nextTick()
    // Vue pas encore écrite (nombres en cours) : la première écriture retire `view`.
    expect(replace).toHaveBeenLastCalledWith({ query: { tab: 'mobile-money' } })
    // Les nombres arrivent avant que la première écriture soit appliquée : la vue est remise.
    list.state.view = 'failed'
    releaseLoad()
    await nextTick()
    expect(replace).toHaveBeenLastCalledWith({ query: { tab: 'mobile-money', view: 'failed' } })
    resolvers.forEach(r => r())
    await flushPromises()
    expect(route.query).toEqual({ tab: 'mobile-money', view: 'failed' })
    replace.mockReset().mockImplementation(async (to: { query: Record<string, unknown> }) => { route.query = to.query })
  })
})
