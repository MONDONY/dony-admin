/**
 * Onglet Colis : statut, recherche et dates vivent dans l'URL, à côté de tab/open/announcementId.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
let query: Record<string, string> = {}
vi.stubGlobal('useRoute', () => ({ meta: {}, query }))

const bids = vi.hoisted(() => ({
  listBids: vi.fn(), counts: vi.fn(), suggest: vi.fn(), getBid: vi.fn(), getTimeline: vi.fn(), listAnnouncements: vi.fn(),
  removeAnnouncement: vi.fn(), restoreAnnouncement: vi.fn(),
}))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: bids }))
vi.mock('@/features/package-requests/services/packageRequestsService', () => ({
  packageRequestsService: { list: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }), get: vi.fn(), remove: vi.fn(), restore: vi.fn() },
}))

const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const COUNTS = { todo: 0, active: 0, recent: 0, completed: 0, closed: 0, all: 0, alerts: { disputeOpen: 0, noShow: 0, paymentPending: 0, late: 0 } }

async function mountPage() {
  const mod = await import('@/pages/colis/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return w
}

describe('/colis : filtres dans l’URL', () => {
  // Premier import de la page à froid : lent quand toute la suite tourne en parallèle.
  beforeAll(async () => { await import('@/pages/colis/index.vue') }, 30_000)

  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    bids.counts.mockResolvedValue(COUNTS)
    bids.suggest.mockResolvedValue({ senders: [], travelers: [], recipients: [], trips: [], parcels: [] })
    query = {}
    bids.listBids.mockResolvedValue(EMPTY)
    bids.listAnnouncements.mockResolvedValue(EMPTY)
  })

  it('applique ?status=IN_TRANSIT&query=YD-42&dateFrom=… au premier chargement et les montre dans les champs', async () => {
    query = { status: 'IN_TRANSIT', query: 'YD-42', dateFrom: '2026-07-01', dateTo: '2026-07-31' }
    const w = await mountPage()
    expect(bids.listBids).toHaveBeenCalledTimes(1)
    expect(bids.listBids.mock.calls[0][0]).toMatchObject({ status: 'IN_TRANSIT', query: 'YD-42', dateFrom: '2026-07-01', dateTo: '2026-07-31' })
    expect((w.find('[data-test="search"]').element as HTMLInputElement).value).toBe('YD-42')
    expect((w.find('[data-test="date-from"]').element as HTMLInputElement).value).toBe('2026-07-01')
  })

  it('un statut inconnu est ignoré', async () => {
    query = { status: 'PIRATE' }
    await mountPage()
    expect(bids.listBids.mock.calls[0][0].status).toBe('TOUS')
  })

  it('choisir un statut réécrit l’URL', async () => {
    const w = await mountPage()
    await w.find('[data-test="filter-status"]').setValue('COMPLETED')
    await flushPromises()
    // La vue « À traiter » (défaut sans paramètre) n'est plus le défaut dès qu'un statut est posé : elle est écrite.
    expect(replaceMock).toHaveBeenCalledWith({ query: { status: 'COMPLETED', view: 'TODO' } })
  })

  it('un lien ?status= montre la vue « Tous » et un statut choisi depuis « Tous » ne l’écrit pas', async () => {
    query = { status: 'IN_TRANSIT' }
    const w = await mountPage()
    expect(bids.listBids.mock.calls[0][0].view).toBe('ALL')
    await w.find('[data-test="filter-status"]').setValue('COMPLETED')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { status: 'COMPLETED' } })
  })

  it('une erreur de chargement des colis est montrée avec « Réessayer »', async () => {
    bids.listBids.mockRejectedValueOnce(new Error('boom'))
    const w = await mountPage()
    expect(w.find('[data-test="state-error"]').exists()).toBe(true)
    bids.listBids.mockResolvedValue(EMPTY)
    await w.find('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(bids.listBids).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
  })
})
