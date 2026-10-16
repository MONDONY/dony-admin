/**
 * /colis déjà ouverte : la recherche globale de la barre du haut ne change que la query.
 * La page suit ?open (colis), ?tab=demandes&open (demande) et ?tab=announcements&announcement.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const route = reactive({ meta: {}, query: {} as Record<string, string> })
const replaceMock = vi.fn((to: { query: Record<string, string> }) => { route.query = to.query })
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
vi.stubGlobal('useRoute', () => route)

const svc = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), remove: vi.fn(), restore: vi.fn() }))
vi.mock('@/features/package-requests/services/packageRequestsService', () => ({ packageRequestsService: svc }))
const bids = vi.hoisted(() => ({
  listBids: vi.fn(), getBid: vi.fn(), getTimeline: vi.fn(), listAnnouncements: vi.fn(),
  removeAnnouncement: vi.fn(), restoreAnnouncement: vi.fn(),
}))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: bids }))

const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const BID = '1c1a0000-0000-4000-8000-0000000000b1'
const REQ = '0b5e2c3a-1111-4222-8333-444455556666'
const ANN = '2a2a0000-0000-4000-8000-0000000000a1'

async function mountPage() {
  const mod = await import('@/pages/colis/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return w
}

describe('/colis suit la query après le montage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    route.query = {}
    bids.listBids.mockResolvedValue(EMPTY)
    bids.listAnnouncements.mockResolvedValue(EMPTY)
    bids.getBid.mockResolvedValue({ id: BID })
    bids.getTimeline.mockResolvedValue({ bidId: BID, entries: [] })
    svc.list.mockResolvedValue(EMPTY)
    svc.get.mockResolvedValue(null)
  })

  it('?open=<colis> ouvre la fiche une seule fois', async () => {
    await mountPage()
    route.query = { open: BID }
    await flushPromises()
    expect(bids.getBid).toHaveBeenCalledTimes(1)
    expect(bids.getBid).toHaveBeenCalledWith(BID)
  })

  it('?tab=demandes&open=<demande> bascule et ouvre la demande', async () => {
    await mountPage()
    route.query = { tab: 'demandes', open: REQ }
    await flushPromises()
    expect(svc.list).toHaveBeenCalled()
    expect(svc.get).toHaveBeenCalledWith(REQ)
  })

  it('?tab=announcements&announcement=<annonce> met l’annonce en avant', async () => {
    await mountPage()
    route.query = { tab: 'announcements', announcement: ANN }
    await flushPromises()
    expect(bids.listAnnouncements).toHaveBeenLastCalledWith(0, expect.any(Number), ANN)
  })

  it('identifiant invalide : rien', async () => {
    await mountPage()
    route.query = { open: '../../x' }
    await flushPromises()
    expect(bids.getBid).not.toHaveBeenCalled()
  })
})
