/**
 * Onglet Colis : vues rapides avec nombres, pastilles d'alerte, recherche à suggestions,
 * puces de filtres actifs, et repli sur l'ancien back (sans `counts` ni `suggest`).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const route = reactive({ meta: {}, query: {} as Record<string, string> })
const replaceMock = vi.fn((to: { query: Record<string, string> }) => { route.query = to.query })
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
vi.stubGlobal('useRoute', () => route)
// La route est partagée : une page restée montée réagirait aux changements du test suivant.
enableAutoUnmount(afterEach)

const bids = vi.hoisted(() => ({
  listBids: vi.fn(), counts: vi.fn(), suggest: vi.fn(), getBid: vi.fn(), getTimeline: vi.fn(), listAnnouncements: vi.fn(),
  removeAnnouncement: vi.fn(), restoreAnnouncement: vi.fn(),
}))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: bids }))
vi.mock('@/features/package-requests/services/packageRequestsService', () => ({
  packageRequestsService: { list: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }), get: vi.fn(), remove: vi.fn(), restore: vi.fn() },
}))

const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const BID = '1c1a0000-0000-4000-8000-0000000000b1'
const ANN = '2a2a0000-0000-4000-8000-0000000000a1'
const row = { id: BID, status: 'IN_TRANSIT', announcementId: ANN, senderName: 'Awa', travelerName: 'Moussa', corridor: 'Paris → Dakar',
  weightKg: 5, netEur: 40, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-06T18:53:35', trackingNumber: 'DON-8ANH6EZR' }
const COUNTS = { todo: 3, active: 10, recent: 2, completed: 40, closed: 5, all: 57, alerts: { disputeOpen: 1, noShow: 0, paymentPending: 1, late: 1 } }
const SUGGEST = {
  senders: [{ id: 'u1', name: 'Awa Diop', count: 2 }], travelers: [], recipients: [], trips: [],
  parcels: [{ bidId: BID, trackingNumber: 'DON-8ANH6EZR', status: 'IN_TRANSIT', content: null }],
}
const MISSING = () => Object.assign(new Error('404'), { statusCode: 404, data: {} })

// Le tiroir lui-même a ses propres tests : ici on vérifie seulement qu'il s'ouvre et se ferme.
const PanelStub = { name: 'BidDetailPanel', template: '<div data-test="bid-detail"><button data-test="bid-close" @click="$emit(\'close\')" /></div>' }

async function mountPage() {
  const mod = await import('@/pages/colis/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { template: '<a><slot /></a>' }, BidDetailPanel: PanelStub } } })
  await flushPromises()
  return w
}
const lastList = () => bids.listBids.mock.lastCall![0]
/** Frappe dans la recherche puis pause des suggestions (200 ms) sur faux minuteurs : aucune attente réelle. */
async function typeSearch(w: Awaited<ReturnType<typeof mountPage>>, text: string) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    const input = w.find('[data-test="search"]')
    await input.setValue(text)
    await input.trigger('input')
    await vi.advanceTimersByTimeAsync(250)
  } finally {
    vi.useRealTimers()
  }
  await flushPromises()
}

describe('/colis : vues rapides et recherche', () => {
  // Premier import de la page à froid : lent quand toute la suite tourne en parallèle.
  beforeAll(async () => { await import('@/pages/colis/index.vue') }, 30_000)

  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    bids.listBids.mockResolvedValue({ ...EMPTY, content: [row], totalElements: 1, totalPages: 1 })
    bids.counts.mockResolvedValue(COUNTS)
    bids.suggest.mockResolvedValue(SUGGEST)
    bids.listAnnouncements.mockResolvedValue(EMPTY)
    bids.getBid.mockResolvedValue({ id: BID })
    bids.getTimeline.mockResolvedValue({ bidId: BID, entries: [] })
  })

  it('defaultView_isTodo_withoutParams', async () => {
    const w = await mountPage()
    expect(bids.listBids).toHaveBeenCalledTimes(1)
    expect(lastList().view).toBe('TODO')
    expect(w.find('[data-test="bid-view-TODO"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test="bid-view-TODO"]').text()).toContain('3')
    expect(bids.counts).toHaveBeenCalledTimes(1)
    // Le défaut n'est pas écrit dans l'URL.
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('defaultView_isAll_withAnnouncementIdParam', async () => {
    route.query = { announcementId: ANN }
    const w = await mountPage()
    expect(lastList()).toMatchObject({ view: 'ALL', announcementId: ANN })
    expect(w.find('[data-test="trip-filter"]').exists()).toBe(true)
    expect(bids.counts).toHaveBeenCalledTimes(1)
  })

  it('defaultView_isAll_withStatusParam', async () => {
    route.query = { status: 'IN_TRANSIT' }
    await mountPage()
    expect(lastList()).toMatchObject({ view: 'ALL', status: 'IN_TRANSIT' })
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('restoresViewFromUrl', async () => {
    route.query = { view: 'COMPLETED' }
    const w = await mountPage()
    expect(lastList().view).toBe('COMPLETED')
    expect(w.find('[data-test="bid-view-COMPLETED"]').attributes('aria-pressed')).toBe('true')
    // Vue « Terminés » : pas de pastilles d'alerte.
    expect(w.find('[data-test="alert-pill-LATE"]').exists()).toBe(false)
  })

  it('invalid params are ignored: no switch to ALL, no stray replace', async () => {
    route.query = { view: 'PIRATE' }
    await mountPage()
    expect(lastList().view).toBe('TODO')
    route.query = { status: 'PIRATE', announcementId: 'garbage' }
    await mountPage()
    expect(lastList()).toMatchObject({ view: 'TODO', status: 'TOUS', announcementId: null })
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('switchingView_updatesUrlAndReloads', async () => {
    const w = await mountPage()
    await w.find('[data-test="bid-view-ALL"]').trigger('click')
    await flushPromises()
    expect(lastList().view).toBe('ALL')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { view: 'ALL' } })
    await w.find('[data-test="bid-view-TODO"]').trigger('click')
    await flushPromises()
    expect(lastList().view).toBe('TODO')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
    // Les nombres ne dépendent pas de la vue.
    expect(bids.counts).toHaveBeenCalledTimes(1)
  })

  it('alert pills filter the TODO view', async () => {
    const w = await mountPage()
    await w.find('[data-test="alert-pill-LATE"]').trigger('click')
    await flushPromises()
    expect(lastList()).toMatchObject({ view: 'TODO', alert: 'LATE' })
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { alert: 'LATE', view: 'TODO' } })
    expect(bids.counts).toHaveBeenCalledTimes(1)
  })

  it('legacyBackend_countsMissing_hidesViewTabsAndPills', async () => {
    bids.counts.mockRejectedValue(MISSING())
    const w = await mountPage()
    expect(w.find('[data-test="bid-view-TODO"]').exists()).toBe(false)
    expect(w.find('[data-test="alert-pill-LATE"]').exists()).toBe(false)
    expect(w.find('[data-test="filter-status"]').exists()).toBe(true)
    expect(w.find('[data-test="filter-payment"]').exists()).toBe(false)
    expect(w.findAll('[data-test^="bid-row-"]')).toHaveLength(1)
    // Vue forcée à « Tous », sans l'écrire dans l'URL.
    await w.find('[data-test="filter-status"]').setValue('COMPLETED')
    await flushPromises()
    expect(lastList()).toMatchObject({ view: 'ALL', status: 'COMPLETED' })
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { status: 'COMPLETED' } })
  })

  it('legacyBackend_suggestMissing_noSuggestions', async () => {
    bids.suggest.mockRejectedValue(MISSING())
    const w = await mountPage()
    await typeSearch(w, 'Aw')
    expect(w.find('[data-test="suggestion-sender-0"]').exists()).toBe(false)
    await typeSearch(w, 'Awa')
    expect(bids.suggest).toHaveBeenCalledTimes(1)
  })

  it('pickSender_setsScopeAndChip', async () => {
    const w = await mountPage()
    await typeSearch(w, 'Aw')
    expect(bids.suggest).toHaveBeenCalledWith('Aw')
    await w.find('[data-test="suggestion-sender-0"]').trigger('click')
    await flushPromises()
    // Une recherche part de « À traiter » vers « Tous » : retrouver un colis d'abord.
    expect(lastList()).toMatchObject({ query: 'Awa Diop', scope: 'SENDER', view: 'ALL' })
    expect(w.find('[data-test="active-chip-search"]').text()).toContain('Expéditeur : Awa Diop')
    expect(route.query).toEqual({ query: 'Awa Diop', scope: 'SENDER' })
    expect((w.find('[data-test="search"]').element as HTMLInputElement).value).toBe('Awa Diop')
    expect(w.find('[data-test="suggestion-sender-0"]').exists()).toBe(false)
  })

  it('removeChip_reloads', async () => {
    route.query = { query: 'Awa', scope: 'SENDER' }
    const w = await mountPage()
    expect(w.find('[data-test="active-chip-search"]').text()).toContain('Expéditeur : Awa')
    const before = bids.listBids.mock.calls.length
    await w.find('[data-test="active-chip-search-remove"]').trigger('click')
    await flushPromises()
    expect(bids.listBids.mock.calls.length).toBe(before + 1)
    expect(lastList()).toMatchObject({ query: '', scope: 'ALL' })
    expect(w.find('[data-test="active-chip-search"]').exists()).toBe(false)
    expect((w.find('[data-test="search"]').element as HTMLInputElement).value).toBe('')
  })

  it('removes the other chips and clears them all', async () => {
    route.query = { status: 'IN_TRANSIT', dateFrom: '2026-07-01', paymentMethod: 'CASH', content: 'livres', alert: 'LATE' }
    const w = await mountPage()
    for (const key of ['status', 'period', 'payment', 'content', 'alert']) {
      await w.find(`[data-test="active-chip-${key}-remove"]`).trigger('click')
      await flushPromises()
    }
    expect(lastList()).toMatchObject({ status: 'TOUS', dateFrom: null, dateTo: null, paymentMethod: null, content: '', alert: null })
    route.query = { query: 'x', content: 'y' }
    const w2 = await mountPage()
    await w2.find('[data-test="active-chips-clear"]').trigger('click')
    await flushPromises()
    expect(lastList()).toMatchObject({ query: '', content: '' })
  })

  it('pickParcel_opensDrawer', async () => {
    const w = await mountPage()
    await typeSearch(w, 'DON')
    const before = bids.listBids.mock.calls.length
    await w.find('[data-test="suggestion-parcel-0"]').trigger('click')
    await flushPromises()
    expect(bids.getBid).toHaveBeenCalledWith(BID)
    expect(route.query).toMatchObject({ open: BID })
    expect(bids.listBids.mock.calls.length).toBe(before)
    expect(w.find('[data-test="bid-detail"]').exists()).toBe(true)
    // Le champ revient à la recherche réellement appliquée (vide), pas à « DON ».
    expect((w.find('[data-test="search"]').element as HTMLInputElement).value).toBe('')
    expect(lastList().view).toBe('TODO')
  })

  it('exactTrackingEnter_opensDrawer', async () => {
    const w = await mountPage()
    await typeSearch(w, 'don-8anh6ezr')
    const before = bids.listBids.mock.calls.length
    await w.find('[data-test="search"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(bids.getBid).toHaveBeenCalledWith(BID)
    expect(bids.listBids.mock.calls.length).toBe(before)
    expect((w.find('[data-test="search"]').element as HTMLInputElement).value).toBe('')
  })

  it('exact tracking number after Escape (list closed) searches instead of opening', async () => {
    const w = await mountPage()
    await typeSearch(w, 'DON-8ANH6EZR')
    await w.find('[data-test="search"]').trigger('keydown', { key: 'Escape' })
    await w.find('[data-test="search"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(bids.getBid).not.toHaveBeenCalled()
    expect(lastList().query).toBe('DON-8ANH6EZR')
  })

  it('Enter on a text that is not a known tracking number searches', async () => {
    const w = await mountPage()
    await typeSearch(w, 'Dakar')
    await w.find('[data-test="search"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(bids.getBid).not.toHaveBeenCalled()
    expect(lastList()).toMatchObject({ query: 'Dakar', view: 'ALL' })
    expect(w.find('[data-test="active-chip-search"]').text()).toContain('Recherche : Dakar')
    // Retirer la recherche ne revient pas tout seul à « À traiter ».
    await w.find('[data-test="active-chip-search-remove"]').trigger('click')
    await flushPromises()
    expect(lastList()).toMatchObject({ query: '', view: 'ALL' })
  })

  it('scope select: no reload with an empty query, reload with one', async () => {
    const w = await mountPage()
    const lists = bids.listBids.mock.calls.length
    await w.find('[data-test="search-scope"]').setValue('TRIP')
    await flushPromises()
    expect(bids.listBids.mock.calls.length).toBe(lists)
    expect(bids.counts).toHaveBeenCalledTimes(1)
    await typeSearch(w, 'Paris')
    await w.find('[data-test="search"]').trigger('keydown', { key: 'Escape' })
    await w.find('[data-test="search"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(lastList()).toMatchObject({ query: 'Paris', scope: 'TRIP', view: 'ALL' })
  })

  it('a status chosen in TODO keeps the TODO view', async () => {
    const w = await mountPage()
    await w.find('[data-test="filter-status"]').setValue('AWAITING_PAYMENT')
    await flushPromises()
    expect(lastList()).toMatchObject({ view: 'TODO', status: 'AWAITING_PAYMENT' })
  })

  it('tripFocus_fromTodo_showsAllAndSurvivesReload (A)', async () => {
    route.query = { open: BID }
    const w = await mountPage()
    expect(lastList().view).toBe('TODO')
    w.findComponent({ name: 'BidDetailPanel' }).vm.$emit('show-trip-bids', ANN)
    await flushPromises()
    expect(lastList()).toMatchObject({ view: 'ALL', announcementId: ANN })
    expect(route.query).toEqual({ announcementId: ANN })
    w.unmount()
    await mountPage()
    expect(lastList()).toMatchObject({ view: 'ALL', announcementId: ANN })
  })

  it('tripFocus_clear_keepsScreenAndUrlConsistent (B)', async () => {
    route.query = { announcementId: ANN }
    const w = await mountPage()
    await w.find('[data-test="trip-filter-clear"]').trigger('click')
    await flushPromises()
    expect(lastList()).toMatchObject({ view: 'ALL', announcementId: null })
    expect(route.query).toEqual({ view: 'ALL' })
    w.unmount()
    await mountPage()
    expect(lastList()).toMatchObject({ view: 'ALL', announcementId: null })
  })

  it('counts error: discreet notice with retry', async () => {
    bids.counts.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }))
    const w = await mountPage()
    expect(w.find('[data-test="bid-counts-error"]').text()).toContain('Nombres indisponibles')
    expect(w.find('[data-test="bid-view-TODO"]').exists()).toBe(true)
    await w.find('[data-test="bid-counts-retry"]').trigger('click')
    await flushPromises()
    expect(bids.counts).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="bid-counts-error"]').exists()).toBe(false)
  })

  it('before counts answer: no view tabs and no « Rien à traiter »', async () => {
    let answer!: (_v: unknown) => void
    bids.counts.mockReturnValue(new Promise((_r, reject) => { answer = reject }))
    bids.listBids.mockResolvedValue(EMPTY)
    const w = await mountPage()
    expect(w.find('[data-test="bid-view-TODO"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Rien à traiter')
    answer(MISSING())
    await flushPromises()
    expect(w.find('[data-test="bid-view-TODO"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Rien à traiter')
  })

  it('emptyTodo_withFilters_saysSoAndOffersAll', async () => {
    bids.listBids.mockResolvedValue(EMPTY)
    route.query = { view: 'TODO', paymentMethod: 'CASH' }
    const w = await mountPage()
    expect(w.find('[data-test="state-empty"]').text()).toContain('Aucun colis à traiter pour ces filtres.')
    expect(w.find('[data-test="todo-show-all"]').text()).toBe('Voir dans Tous')
    await w.find('[data-test="todo-show-all"]').trigger('click')
    await flushPromises()
    expect(lastList()).toMatchObject({ view: 'ALL', paymentMethod: 'CASH' })
  })

  it('countsReloadAfterFilterChange', async () => {
    const w = await mountPage()
    expect(bids.counts).toHaveBeenCalledTimes(1)
    await w.find('[data-test="filter-content"]').setValue('livres')
    await w.find('[data-test="filter-content"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(bids.counts).toHaveBeenCalledTimes(2)
    await w.find('[data-test="filter-payment"]').setValue('CASH')
    await flushPromises()
    expect(bids.counts).toHaveBeenCalledTimes(3)
    expect(lastList()).toMatchObject({ content: 'livres', paymentMethod: 'CASH' })
    await w.find('[data-test="date-from"]').setValue('2026-07-01')
    await w.find('[data-test="date-from"]').trigger('change')
    await flushPromises()
    expect(bids.counts).toHaveBeenCalledTimes(4)
    // Vue et statut : la liste change, pas les nombres.
    await w.find('[data-test="filter-status"]').setValue('COMPLETED')
    await w.find('[data-test="bid-view-ACTIVE"]').trigger('click')
    await flushPromises()
    expect(bids.counts).toHaveBeenCalledTimes(4)
  })

  it('bidChanged_reloadsCounts', async () => {
    route.query = { open: BID }
    const w = await mountPage()
    expect(bids.counts).toHaveBeenCalledTimes(1)
    w.findComponent({ name: 'BidDetailPanel' }).vm.$emit('changed')
    await flushPromises()
    expect(bids.counts).toHaveBeenCalledTimes(2)
    expect(bids.getBid).toHaveBeenCalledTimes(2)
  })

  it('drawer open and close keep the view and the filters', async () => {
    route.query = { view: 'ACTIVE', query: 'Awa' }
    const w = await mountPage()
    await w.find(`[data-test="bid-row-${BID}"]`).trigger('click')
    await flushPromises()
    expect(route.query).toEqual({ view: 'ACTIVE', query: 'Awa', open: BID })
    await w.find('[data-test="bid-close"]').trigger('click')
    await flushPromises()
    expect(route.query).toEqual({ view: 'ACTIVE', query: 'Awa' })
    expect(lastList()).toMatchObject({ view: 'ACTIVE', query: 'Awa' })
  })

  it('emptyTodo_showsNothingToDo', async () => {
    bids.listBids.mockResolvedValue(EMPTY)
    const w = await mountPage()
    expect(w.find('[data-test="state-empty"]').text()).toContain('Rien à traiter pour l’instant.')
    await w.find('[data-test="todo-show-all"]').trigger('click')
    await flushPromises()
    expect(lastList().view).toBe('ALL')
    expect(w.find('[data-test="state-empty"]').text()).toContain('Aucun colis')
    expect(w.find('[data-test="todo-show-all"]').exists()).toBe(false)
  })
})
