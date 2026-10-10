/**
 * Onglet « Colis » de /colis : la fiche s'ouvre et se ferme dans l'URL (?open=), « Voir
 * l'annonce » et « autres colis sur ce trajet » filtrent les onglets, liens profonds.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
const replaceMock = vi.fn()
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
let query: Record<string, string> = {}
vi.stubGlobal('useRoute', () => ({ meta: {}, query }))

const svc = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), remove: vi.fn(), restore: vi.fn() }))
vi.mock('@/features/package-requests/services/packageRequestsService', () => ({ packageRequestsService: svc }))
const bids = vi.hoisted(() => ({
  listBids: vi.fn(), getBid: vi.fn(), getTimeline: vi.fn(), listAnnouncements: vi.fn(),
  removeAnnouncement: vi.fn(), restoreAnnouncement: vi.fn(),
}))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: bids }))

const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const row = { id: 'b1', status: 'ACCEPTED', announcementId: '2a2a0000-0000-4000-8000-0000000000a1', senderName: 'Awa', travelerName: 'Moussa',
  corridor: 'Paris → Bamako', weightKg: 5, netEur: 40, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-06T18:53:35' }
const detail = { ...row, contentCategory: null, recipientName: null, trackingNumber: 'DON-8ANH6EZR', commissionRate: 0.12,
  refusalReason: null, trip: { announcementId: '2a2a0000-0000-4000-8000-0000000000a1', status: 'ACTIVE', departureCity: 'Paris', arrivalCity: 'Bamako',
    departureCountryCode: 'FR', arrivalCountryCode: 'ML', departureDate: '2026-10-12', departureTime: null, departureAt: null,
    arrivalDate: null, arrivalTime: null, timezone: null, pickupAddressLabel: null, deliveryAddressLabel: null, transportMode: 'PLANE',
    totalKg: 23, availableKg: 15, reservedKg: 0, capacityUnit: 'KG', pricePerKg: 8, tripGroupId: null, tripLegIndex: null,
    handoverDeadline: null, otherBidsCount: 2 }, money: null, links: null }
const ann = { id: '2a2a0000-0000-4000-8000-0000000000a1', status: 'ACTIVE', travelerName: 'Moussa', corridor: 'Paris → Bamako', departureDate: '2026-10-12', availableKg: 15, pricePerKg: 8, currency: 'EUR' }

async function mountPage() {
  const mod = await import('@/pages/colis/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { template: '<a><slot /></a>' }, StripeResyncPanel: true, StartSupportConversationDialog: true } } })
  await flushPromises()
  return w
}

describe('/colis, fiche colis', () => {
  // Premier import de la page à froid : lent quand toute la suite tourne en parallèle.
  beforeAll(async () => { await import('@/pages/colis/index.vue') }, 30_000)

  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    query = {}
    bids.listBids.mockResolvedValue({ ...EMPTY, content: [row], totalElements: 1, totalPages: 1 })
    bids.listAnnouncements.mockResolvedValue({ ...EMPTY, content: [ann], totalElements: 1, totalPages: 1 })
    bids.getBid.mockResolvedValue(detail)
    bids.getTimeline.mockResolvedValue({ bidId: 'b1', entries: [] })
  })

  it('libellé de l’onglet : Colis, et non Bids', async () => {
    const w = await mountPage()
    expect(w.find('[data-test="tab-bids"]').text()).toBe('Colis')
  })

  it('clic sur une ligne : fiche ouverte et ?open= dans l’URL ; Fermer le retire', async () => {
    const w = await mountPage()
    await w.find('[data-test="bid-row-b1"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { open: 'b1' } })
    expect(w.find('[data-test="bid-detail"]').exists()).toBe(true)
    expect(w.find('[data-test="timeline-empty"]').exists()).toBe(true)
    await w.find('[data-test="bid-close"]').trigger('click')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
    expect(w.find('[data-test="bid-detail"]').exists()).toBe(false)
  })

  it('« autres colis sur ce trajet » filtre la liste et l’URL, « Voir tous les colis » l’enlève', async () => {
    query = { open: '1c1a0000-0000-4000-8000-0000000000b1' }
    const w = await mountPage()
    await w.find('[data-test="trip-other-bids"]').trigger('click')
    await flushPromises()
    expect(bids.listBids).toHaveBeenLastCalledWith(expect.objectContaining({ announcementId: '2a2a0000-0000-4000-8000-0000000000a1' }), 0, 20)
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { announcementId: '2a2a0000-0000-4000-8000-0000000000a1' } })
    expect(w.find('[data-test="trip-filter"]').exists()).toBe(true)
    await w.find('[data-test="trip-filter-clear"]').trigger('click')
    await flushPromises()
    expect(bids.listBids).toHaveBeenLastCalledWith(expect.objectContaining({ announcementId: null }), 0, 20)
    expect(w.find('[data-test="trip-filter"]').exists()).toBe(false)
  })

  it('« Voir l’annonce » ouvre l’onglet Annonces réduit à l’annonce du colis', async () => {
    query = { open: '1c1a0000-0000-4000-8000-0000000000b1' }
    const w = await mountPage()
    await w.find('[data-test="trip-open-announcement"]').trigger('click')
    await flushPromises()
    expect(bids.listAnnouncements).toHaveBeenLastCalledWith(0, 20, '2a2a0000-0000-4000-8000-0000000000a1')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'announcements', announcement: '2a2a0000-0000-4000-8000-0000000000a1' } })
    expect(w.find('[data-test="ann-row-2a2a0000-0000-4000-8000-0000000000a1"]').exists()).toBe(true)
    await w.find('[data-test="announcement-focus-clear"]').trigger('click')
    await flushPromises()
    expect(bids.listAnnouncements).toHaveBeenLastCalledWith(0, 20)
    expect(w.find('[data-test="announcement-focus"]').exists()).toBe(false)
  })

  it('liens profonds : ?announcementId= et ?tab=announcements&announcement=', async () => {
    query = { announcementId: '2a2a0000-0000-4000-8000-0000000000a1' }
    await mountPage()
    expect(bids.listBids).toHaveBeenCalledWith(expect.objectContaining({ announcementId: '2a2a0000-0000-4000-8000-0000000000a1' }), 0, 20)
    vi.clearAllMocks()
    bids.listAnnouncements.mockResolvedValue({ ...EMPTY, content: [ann] })
    query = { tab: 'announcements', announcement: '2a2a0000-0000-4000-8000-0000000000a1' }
    const w = await mountPage()
    expect(bids.listAnnouncements).toHaveBeenCalledWith(0, 20, '2a2a0000-0000-4000-8000-0000000000a1')
    expect(w.find('[data-test="announcement-focus"]').exists()).toBe(true)
  })

  it('colis introuvable : erreur dans le panneau, refermable', async () => {
    query = { open: '1c1a0000-0000-4000-8000-0000000000ff' }
    bids.getBid.mockRejectedValue(Object.assign(new Error('404'), { data: { detail: 'Colis introuvable' } }))
    const w = await mountPage()
    expect(w.find('[data-test="bid-detail-error"]').text()).toBe('Colis introuvable')
    await w.find('[data-test="bid-detail-pending-close"]').trigger('click')
    expect(w.find('[data-test="bid-detail-pending"]').exists()).toBe(false)
  })

  it('changer d’onglet ferme la fiche', async () => {
    query = { open: '1c1a0000-0000-4000-8000-0000000000b1' }
    const w = await mountPage()
    await w.find('[data-test="tab-announcements"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="tab-bids"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="bid-detail"]').exists()).toBe(false)
  })
  it('?open=, ?announcementId= ou ?announcement= malveillants : ignorés, aucun appel', async () => {
    query = { open: '../../admin/x', announcementId: '../x' }
    await mountPage()
    expect(bids.getBid).not.toHaveBeenCalled()
    expect(bids.getTimeline).not.toHaveBeenCalled()
    expect(bids.listBids).toHaveBeenCalledWith(expect.objectContaining({ announcementId: null }), 0, 20)
    vi.clearAllMocks()
    bids.listAnnouncements.mockResolvedValue({ ...EMPTY, content: [ann] })
    query = { tab: 'announcements', announcement: 'javascript:alert(1)' }
    await mountPage()
    expect(bids.listAnnouncements).toHaveBeenCalledWith(0, 20)
  })
  it('?tab=demandes&open= malveillant : la fiche ne s’ouvre pas', async () => {
    svc.list.mockResolvedValue(EMPTY)
    query = { tab: 'demandes', open: '../../admin/x' }
    await mountPage()
    expect(svc.get).not.toHaveBeenCalled()
  })
})
