/** /tarification : onglets dans l'URL, états du chargement, câblage des trois onglets. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const route = vi.hoisted(() => ({ meta: {}, query: {} as Record<string, string> }))
const replace = vi.hoisted(() => vi.fn())
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => ({ replace }))

const grids = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
const settings = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: grids }))
vi.mock('@/features/settings/services/settingsService', () => ({ settingsService: settings }))

const GRID = {
  id: 'g1', effectiveFrom: '2026-10-01T08:00:00',
  tiers: [{ fromEur: 0, rate: 0.07 }], minimums: { EUR: 1 },
}
const LIST = { current: GRID, history: { content: [GRID], page: 0, size: 20, totalElements: 1, totalPages: 1, last: true } }

async function mountPage() {
  const mod = await import('@/pages/tarification.vue')
  const w = mount(mod.default)
  await flushPromises()
  return w
}

describe('/tarification', () => {
  beforeAll(async () => { await import('@/pages/tarification.vue') }, 30_000)

  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    grids.list.mockResolvedValue(LIST)
    grids.simulate.mockResolvedValue({ rows: [], warnings: [], connectActiveAccountMonthly: 2 })
    settings.list.mockResolvedValue([{ key: 'commission_rate', value: '0.05', type: 'DECIMAL', updatedAt: null, updatedByEmail: null }])
  })

  it('ouvre l’onglet Grille par défaut avec la grille en vigueur', async () => {
    const w = await mountPage()
    expect(grids.list).toHaveBeenCalledWith(0, 20)
    expect(w.find('[data-test="grid-current"]').text()).toContain('En vigueur depuis le')
  })

  it('aucune grille : le taux unique des Paramètres', async () => {
    grids.list.mockResolvedValue({ history: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, last: true } })
    const w = await mountPage()
    expect(w.find('[data-test="grid-current-empty"]').text().replace(/[\u00a0\u202f]/g, ' ')).toContain('taux unique de 5 %')
  })

  it('?tab=historique ouvre l’historique ; changer d’onglet met l’URL à jour', async () => {
    route.query = { tab: 'historique', other: 'x' }
    const w = await mountPage()
    expect(w.find('[data-test="history-list"]').exists()).toBe(true)
    await w.find('[data-test="tarification-tab-simulateur"]').trigger('click')
    expect(replace).toHaveBeenLastCalledWith({ query: { other: 'x', tab: 'simulateur' } })
    await flushPromises()
    expect(w.find('[data-test="simulator-source"]').exists()).toBe(true)
    await w.find('[data-test="tarification-tab-grille"]').trigger('click')
    expect(replace).toHaveBeenLastCalledWith({ query: { other: 'x' } })
  })

  it('onglet inconnu → Grille', async () => {
    route.query = { tab: 'nope' }
    const w = await mountPage()
    expect(w.find('[data-test="grid-current"]').exists()).toBe(true)
  })

  it('back sans l’endpoint : mention de mise à jour du serveur', async () => {
    grids.list.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404 }))
    const w = await mountPage()
    expect(w.find('[data-test="tarification-unavailable"]').text()).toContain('mise à jour du serveur')
  })

  it('annuler la grille programmée : message de succès', async () => {
    const scheduled = { ...GRID, id: 'g2', effectiveFrom: '2099-01-01T00:00:00' }
    grids.list.mockResolvedValueOnce({ ...LIST, scheduled }).mockResolvedValue(LIST)
    grids.cancel.mockResolvedValue(undefined)
    settings.list.mockRejectedValue(new Error('boom'))
    const w = await mountPage()
    await w.find('[data-test="grid-scheduled-cancel"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(grids.cancel).toHaveBeenCalledWith('g2')
    expect(w.find('[data-test="tarification-message"]').text()).toBe('La grille programmée est annulée.')
  })

  it('erreur de chargement affichée', async () => {
    grids.list.mockRejectedValue(Object.assign(new Error('500'), { statusCode: 500, data: { detail: 'Panne' } }))
    const w = await mountPage()
    expect(w.find('[data-test="tarification-error"]').text()).toBe('Panne')
  })
})
