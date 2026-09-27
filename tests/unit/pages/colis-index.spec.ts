/**
 * Onglet « Demandes » de /colis : lien profond (?tab=demandes&open=<id>), mémorisation de
 * l'onglet dans l'URL, tolérance de l'ancien back et répercussion d'un retrait sur la ligne.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
const row = { id: 'pr1', senderId: 's1', senderName: 'Awa', departureCity: 'Paris', arrivalCity: 'Dakar', desiredDate: null,
  weightKg: 3, parcelSize: 'SMALL', transportMode: null, status: 'OPEN', currency: 'EUR', targetPrice: 30,
  createdAt: '2026-09-20T10:00:00Z', reportCount: 2, openNegotiationCount: 1 }
const detail = { ...row, description: null, contentCategory: null, pickupNeighborhood: null, deliveryNeighborhood: null,
  pickupAddressLabel: null, deliveryAddressLabel: null, acceptedPaymentMethods: [], negotiable: true, statusBeforeRemoval: null,
  photos: [], negotiations: [], reports: [], canRemove: true, removeBlockedReason: null, canRestore: false }

async function mountPage() {
  const mod = await import('@/pages/colis/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } } })
  await flushPromises()
  return w
}

describe('/colis, onglet Demandes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedAuth('ADMIN')
    query = {}
    bids.listBids.mockResolvedValue(EMPTY)
    bids.listAnnouncements.mockResolvedValue(EMPTY)
    svc.list.mockResolvedValue({ ...EMPTY, content: [row], totalElements: 1, totalPages: 1 })
    svc.get.mockResolvedValue(detail)
  })

  it('lien profond : ouvre l’onglet et la fiche, sans charger les bids', async () => {
    query = { tab: 'demandes', open: 'pr1' }
    const w = await mountPage()
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(svc.get).toHaveBeenCalledWith('pr1')
    expect(bids.listBids).not.toHaveBeenCalled()
    expect(w.find('[data-test="pr-row-pr1"]').exists()).toBe(true)
    expect(w.find('[data-test="pr-detail"]').exists()).toBe(true)
  })

  it('bascule d’onglet mémorisée dans l’URL, clic sur une ligne ajoute open', async () => {
    const w = await mountPage()
    expect(bids.listBids).toHaveBeenCalledTimes(1)
    await w.find('[data-test="tab-demandes"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'demandes' } })
    await w.find('[data-test="pr-row-pr1"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'demandes', open: 'pr1' } })
    await w.find('[data-test="pr-close"]').trigger('click')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'demandes' } })
    await w.find('[data-test="tab-bids"]').trigger('click')
    expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
    expect(bids.listBids).toHaveBeenCalledTimes(1)
  })

  it('?tab=announcements ouvre les annonces, puis les bids se chargent au premier passage', async () => {
    query = { tab: 'announcements' }
    const w = await mountPage()
    expect(bids.listAnnouncements).toHaveBeenCalledTimes(1)
    expect(bids.listBids).not.toHaveBeenCalled()
    await w.find('[data-test="tab-bids"]').trigger('click')
    await flushPromises()
    expect(bids.listBids).toHaveBeenCalledTimes(1)
  })

  it('ancien back : mention « indisponible », pas d’erreur rouge', async () => {
    query = { tab: 'demandes' }
    svc.list.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, data: {} }))
    const w = await mountPage()
    expect(w.find('[data-test="pr-unavailable"]').text()).toBe('Modération des demandes indisponible pour le moment')
    expect(w.find('[data-test="pr-error"]').exists()).toBe(false)
  })

  it('fiche introuvable : erreur dans le panneau, refermable', async () => {
    query = { tab: 'demandes', open: 'zz' }
    svc.get.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, data: { code: 'package-request-not-found', detail: 'Demande introuvable' } }))
    const w = await mountPage()
    expect(w.find('[data-test="pr-detail-error"]').text()).toBe('Demande introuvable')
    await w.find('[data-test="pr-detail-pending-close"]').trigger('click')
    expect(w.find('[data-test="pr-detail-pending"]').exists()).toBe(false)
  })

  it('un retrait réussi met à jour la ligne de la liste', async () => {
    query = { tab: 'demandes', open: 'pr1' }
    svc.remove.mockResolvedValue({ ...detail, status: 'REMOVED_BY_ADMIN', canRemove: false, canRestore: true, openNegotiationCount: 0 })
    svc.restore.mockResolvedValue({ ...detail })
    const w = await mountPage()
    await w.find('[data-test="pr-remove"]').trigger('click')
    await w.find('[data-test="reason-choice"]').setValue('OTHER')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.remove).toHaveBeenCalledWith('pr1', 'OTHER', '')
    expect(w.find('[data-test="pr-row-pr1"]').text()).toContain('Retirée')
    await w.find('[data-test="pr-restore"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="pr-row-pr1"]').text()).toContain('Ouverte')
  })
})
