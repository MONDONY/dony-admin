/**
 * Page /incidents : onglet actif porté par l'URL (?tab=disputes|noshows), liens profonds des
 * notifications DISPUTE_OPENED et NOSHOW_PENDING.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
const route = reactive<{ meta: Record<string, unknown>; query: Record<string, string> }>({ meta: {}, query: {} })
vi.stubGlobal('useRoute', () => route)

const incidents = vi.hoisted(() => ({ listDisputes: vi.fn(), listNoShows: vi.fn(), getDispute: vi.fn(), confirmNoShow: vi.fn(), rejectNoShow: vi.fn(), confirmLegacyNoShow: vi.fn() }))
vi.mock('@/features/incidents/services/incidentsService', () => ({ incidentsService: incidents }))

const empty = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

const PanelStub = { name: 'NoShowDetailPanel', props: ['row', 'decide'], emits: ['close'], template: '<div data-test="panel-stub">{{ row.id }}</div>' }
const ns = (id: string, over: Record<string, unknown> = {}) => ({ id, bidId: `b-${id}`, legacy: false, scope: 'DELIVERY', status: 'PENDING_CONFIRMATION', canConfirm: true, canReject: true, ...over })

// Une page d'un test précédent encore montée réagirait aux changements de la route partagée.
const mounted: VueWrapper[] = []
async function mountPage() {
  const mod = await import('@/pages/incidents/index.vue')
  const w = mount(mod.default, { global: { stubs: { DisputesTable: true, NoShowsTable: true, DisputeDetailPanel: true, PaginationControls: true, NoShowFilters: true, NoShowDetailPanel: PanelStub } } })
  mounted.push(w)
  await flushPromises()
  return w
}
const pressed = (w: Awaited<ReturnType<typeof mountPage>>, t: string) => w.find(`[data-test="tab-${t}"]`).attributes('aria-pressed')

describe('/incidents : onglet dans l’URL', () => {
  afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()) })
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    incidents.listDisputes.mockResolvedValue(empty)
    incidents.listNoShows.mockResolvedValue(empty)
    replaceMock.mockResolvedValue(undefined)
  })

  it('sans paramètre : Litiges', async () => {
    const w = await mountPage()
    expect(pressed(w, 'disputes')).toBe('true')
    expect(incidents.listNoShows).not.toHaveBeenCalled()
  })

  it('?tab=noshows : onglet No-shows actif et chargé dès le montage', async () => {
    route.query = { tab: 'noshows' }
    const w = await mountPage()
    expect(pressed(w, 'noshows')).toBe('true')
    expect(incidents.listNoShows).toHaveBeenCalledTimes(1)
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('?tab=disputes et valeur inconnue : Litiges', async () => {
    route.query = { tab: 'disputes' }
    expect(pressed(await mountPage(), 'disputes')).toBe('true')
    route.query = { tab: 'nimporte' }
    expect(pressed(await mountPage(), 'disputes')).toBe('true')
  })

  it('navigation interne vers ?tab=noshows alors que la page est ouverte', async () => {
    const w = await mountPage()
    route.query = { tab: 'noshows' }
    await flushPromises()
    expect(pressed(w, 'noshows')).toBe('true')
    route.query = { tab: 'disputes' }
    await flushPromises()
    expect(pressed(w, 'disputes')).toBe('true')
  })

  it('un clic sur un onglet le reporte dans l’URL sans perdre les autres paramètres', async () => {
    route.query = { foo: 'bar' }
    const w = await mountPage()
    await w.find('[data-test="tab-noshows"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { foo: 'bar', tab: 'noshows' } })
    route.query = { foo: 'bar', tab: 'noshows' }
    await w.find('[data-test="tab-disputes"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { foo: 'bar' } })
  })

  it('?tab=noshows&open=<id> : ouvre le panneau du no-show', async () => {
    incidents.listNoShows.mockResolvedValue({ ...empty, content: [ns('c1')], totalPages: 1 })
    route.query = { tab: 'noshows', open: 'c1' }
    const w = await mountPage()
    expect(w.find('[data-test="panel-stub"]').text()).toBe('c1')
  })

  it('sélectionner puis fermer un no-show met à jour ?open', async () => {
    incidents.listNoShows.mockResolvedValue({ ...empty, content: [ns('c1')], totalPages: 1 })
    route.query = { tab: 'noshows' }
    const w = await mountPage()
    w.findComponent({ name: 'NoShowsTable' }).vm.$emit('select', ns('c1'))
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'noshows', open: 'c1' } })
    route.query = { tab: 'noshows', open: 'c1' }
    await flushPromises()
    w.findComponent({ name: 'NoShowDetailPanel' }).vm.$emit('close')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'noshows' } })
    expect(w.find('[data-test="panel-stub"]').exists()).toBe(false)
  })

  it('confirmer à l’arrivée recharge aussi les litiges', async () => {
    incidents.listNoShows.mockResolvedValue({ ...empty, content: [ns('c1')], totalPages: 1 })
    incidents.confirmNoShow.mockResolvedValue(ns('c1', { status: 'CONFIRMED', dispute: { id: 'd1', status: 'OPEN' } }))
    route.query = { tab: 'noshows', open: 'c1' }
    const w = await mountPage()
    const before = incidents.listDisputes.mock.calls.length
    const decide = w.findComponent({ name: 'NoShowDetailPanel' }).props('decide') as (_d: string, _r: string) => Promise<{ ok: boolean }>
    const res = await decide('confirm', 'Destinataire injoignable toute la journée')
    expect(res.ok).toBe(true)
    expect(incidents.listDisputes.mock.calls.length).toBe(before + 1)
  })

  it('confirmé à l’arrivée sans litige encore créé : litiges relus ~1 s plus tard', async () => {
    incidents.listNoShows.mockResolvedValue({ ...empty, content: [ns('c1')], totalPages: 1 })
    incidents.confirmNoShow.mockResolvedValue(ns('c1', { status: 'CONFIRMED', adminDecision: 'CONFIRMED', dispute: null }))
    route.query = { tab: 'noshows', open: 'c1' }
    const w = await mountPage()
    vi.useFakeTimers()
    try {
      const before = incidents.listDisputes.mock.calls.length
      const decide = w.findComponent({ name: 'NoShowDetailPanel' }).props('decide') as (_d: string, _r: string) => Promise<{ ok: boolean }>
      await decide('confirm', 'Destinataire injoignable toute la journée')
      expect(incidents.listDisputes.mock.calls.length).toBe(before)
      await vi.advanceTimersByTimeAsync(1000)
      expect(incidents.listDisputes.mock.calls.length).toBe(before + 1)
    } finally { vi.useRealTimers() }
  })

  it('?tab=disputes&open=<id> ouvre le litige ; le fermer retire open de l’URL', async () => {
    incidents.getDispute.mockResolvedValue({ id: 'd1', status: 'OPEN' })
    route.query = { tab: 'disputes', open: 'd1' }
    const w = await mountPage()
    expect(incidents.getDispute).toHaveBeenCalledWith('d1')
    w.findComponent({ name: 'DisputeDetailPanel' }).vm.$emit('close')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
  })

  it('page ouverte : le badge « Litige ouvert » d’un no-show bascule sur le litige', async () => {
    incidents.getDispute.mockResolvedValue({ id: 'd1', status: 'OPEN' })
    route.query = { tab: 'noshows' }
    const w = await mountPage()
    route.query = { tab: 'disputes', open: 'd1' }
    await flushPromises()
    expect(pressed(w, 'disputes')).toBe('true')
    expect(incidents.getDispute).toHaveBeenCalledWith('d1')
  })
})
