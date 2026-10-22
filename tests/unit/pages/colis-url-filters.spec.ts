/**
 * Onglet Colis : statut, recherche et dates vivent dans l'URL, à côté de tab/open/announcementId.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
let query: Record<string, string> = {}
vi.stubGlobal('useRoute', () => ({ meta: {}, query }))

const bids = vi.hoisted(() => ({
  listBids: vi.fn(), getBid: vi.fn(), getTimeline: vi.fn(), listAnnouncements: vi.fn(),
  removeAnnouncement: vi.fn(), restoreAnnouncement: vi.fn(),
}))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: bids }))
vi.mock('@/features/package-requests/services/packageRequestsService', () => ({
  packageRequestsService: { list: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }), get: vi.fn(), remove: vi.fn(), restore: vi.fn() },
}))

const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

async function mountPage() {
  const mod = await import('@/pages/colis/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return w
}

describe('/colis : filtres dans l’URL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
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
    await w.find('[data-test="chip-status-COMPLETED"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenCalledWith({ query: { status: 'COMPLETED' } })
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
