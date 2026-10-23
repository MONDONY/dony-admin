import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
const svc = vi.hoisted(() => ({ photos: vi.fn() }))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: svc }))
import BidPhotoGallery from '@/features/bids/components/BidPhotoGallery.vue'
import type { AdminBidDetail, AdminBidPhoto, AdminBidTimeline, PhotoStage } from '@/features/bids/types/index'

const photo = (id: string, stage: PhotoStage, over: Partial<AdminBidPhoto> = {}): AdminBidPhoto =>
  ({ id, stage, label: stage, at: '2026-06-01T10:00:00Z', url: `https://r2/${id}.jpg`, ...over })
const bid = (over: Record<string, unknown> = {}) => ({ id: 'b1', status: 'IN_TRANSIT', createdAt: '2026-05-30T08:00:00', ...over }) as unknown as AdminBidDetail

const wrappers: VueWrapper[] = []
function mountGallery(props: { bid?: AdminBidDetail; timeline?: AdminBidTimeline | null } = {}) {
  const w = mount(BidPhotoGallery, { props: { bid: props.bid ?? bid(), timeline: props.timeline ?? null }, attachTo: document.body })
  wrappers.push(w)
  return w
}
const mainSrc = () => document.querySelector('[data-test="photo-main"]')?.getAttribute('src')

describe('BidPhotoGallery', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { while (wrappers.length) wrappers.pop()!.unmount() })

  it('groupsByStage_fourFixedStages', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [
      photo('d1', 'DEPART', { gpsLabel: 'Paris 11e' }), photo('d2', 'DEPART', { at: '2026-06-02T10:00:00Z' }), photo('t1', 'TRANSIT'),
    ] })
    const w = mountGallery(); await flushPromises()
    expect(svc.photos).toHaveBeenCalledWith('b1')
    const stages = w.findAll('[data-test^="photos-stage-"]').map(s => s.attributes('data-test'))
    expect(stages).toEqual(['photos-stage-CREATION', 'photos-stage-DEPART', 'photos-stage-TRANSIT', 'photos-stage-ARRIVEE'])
    const depart = w.find('[data-test="photos-stage-DEPART"]')
    expect(depart.text()).toContain('Remise du colis')
    expect(depart.text()).toContain('01/06/2026 12:00')
    expect(depart.text()).toContain('Paris 11e')
    expect(depart.text()).toContain('2 photos')
    const img = w.find('[data-test="photo-DEPART-1"] img')
    expect(img.attributes('src')).toBe('https://r2/d2.jpg')
    expect(img.attributes('alt')).toBe('Photo : Remise du colis 2')
    expect(img.attributes('loading')).toBe('lazy')
    expect(w.find('[data-test="photo-TRANSIT-0"]').element.tagName).toBe('BUTTON')
  })

  it('emptyStage_showsPlaceholder', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    expect(w.find('[data-test="photos-empty-CREATION"]').text()).toBe('Aucune photo pour cette étape')
    expect(w.find('[data-test="photos-empty-ARRIVEE"]').exists()).toBe(true)
    expect(w.find('[data-test="photos-empty-DEPART"]').exists()).toBe(false)
  })

  it('refusalAndDispute_onlyWhenPresent', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    expect(w.find('[data-test="photos-stage-REFUSAL"]').exists()).toBe(false)
    expect(w.find('[data-test="photos-stage-DISPUTE"]').exists()).toBe(false)
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [photo('r1', 'REFUSAL'), photo('x1', 'DISPUTE')] })
    const w2 = mountGallery(); await flushPromises()
    expect(w2.find('[data-test="photos-stage-REFUSAL"]').text()).toContain('Refus du colis')
    expect(w2.find('[data-test="photos-stage-DISPUTE"]').text()).toContain('Preuves du litige')
  })

  it('click_opensViewerAtIndex', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [
      photo('x1', 'DISPUTE'), photo('d1', 'DEPART'), photo('c1', 'CREATION'), photo('t1', 'TRANSIT', { gpsLabel: 'Roissy' }),
    ] })
    const w = mountGallery(); await flushPromises()
    expect(document.querySelector('[data-test="photo-viewer"]')).toBeNull()
    await w.find('[data-test="photo-TRANSIT-0"]').trigger('click')
    expect(mainSrc()).toBe('https://r2/t1.jpg')
    expect(document.querySelector('[data-test="photo-caption"]')!.textContent).toBe('En transit · 01/06/2026 12:00')
    expect(document.querySelector('[data-test="photo-subcaption"]')!.textContent).toBe('Roissy')
    // Toutes les photos, dans l'ordre des étapes.
    const thumbs = [...document.querySelectorAll('[data-test^="photo-thumb-"] img')].map(i => i.getAttribute('src'))
    expect(thumbs).toEqual(['https://r2/c1.jpg', 'https://r2/d1.jpg', 'https://r2/t1.jpg', 'https://r2/x1.jpg'])
    expect(document.querySelector('[data-test="photo-position"]')!.textContent).toBe('3 sur 4')
    ;(document.querySelector('[data-test="photo-viewer-close"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('[data-test="photo-viewer"]')).toBeNull()
  })

  it('legacyBackend_usesFallbackPhotos', async () => {
    svc.photos.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404, data: {} }))
    const timeline: AdminBidTimeline = { bidId: 'b1', entries: [
      { at: '2026-06-01T10:00:00', kind: 'SCAN', label: 'DEPART', photoUrl: 'https://r2/scan.jpg' },
    ] }
    const w = mountGallery({ bid: bid({ photoUrls: ['https://r2/created.jpg'] }), timeline }); await flushPromises()
    expect(w.find('[data-test="photo-CREATION-0"] img').attributes('src')).toBe('https://r2/created.jpg')
    expect(w.find('[data-test="photo-DEPART-0"] img').attributes('src')).toBe('https://r2/scan.jpg')
    // Heure du serveur sans fuseau lue en UTC, affichée à Paris.
    expect(w.find('[data-test="photos-stage-DEPART"]').text()).toContain('01/06/2026 12:00')
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
    // La chronologie arrive après coup : la galerie suit.
    await w.setProps({ timeline: { bidId: 'b1', entries: [
      { at: '2026-06-01T10:00:00', kind: 'SCAN', label: 'DEPART', photoUrl: 'https://r2/scan.jpg' },
      { at: '2026-06-02T10:00:00', kind: 'SCAN', label: 'ARRIVEE', photoUrl: 'https://r2/arr.jpg' },
    ] } })
    expect(w.find('[data-test="photo-ARRIVEE-0"]').exists()).toBe(true)
  })

  it('dropsNonHttpsUrls', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [
      photo('ok', 'DEPART'), photo('h', 'DEPART', { url: 'http://x/y.jpg' }), photo('j', 'DEPART', { url: 'javascript:alert(1)' }),
    ] })
    const w = mountGallery(); await flushPromises()
    expect(w.findAll('[data-test^="photo-DEPART-"]')).toHaveLength(1)
    expect(w.html()).not.toContain('javascript:')
    svc.photos.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 405, data: {} }))
    const w2 = mountGallery({ bid: bid({ photoUrls: ['http://bad/1.jpg', 'https://r2/good.jpg'] }) }); await flushPromises()
    expect(w2.findAll('[data-test^="photo-CREATION-"]')).toHaveLength(1)
    expect(w2.html()).not.toContain('http://bad')
  })

  it('chargement : squelette ; erreur : Réessayer', async () => {
    let reject!: (_e: unknown) => void
    svc.photos.mockReturnValueOnce(new Promise((_, r) => { reject = r }))
    const w = mountGallery(); await flushPromises()
    expect(w.find('[data-test="photos-loading"]').exists()).toBe(true)
    expect(w.find('[data-test^="photos-stage-"]').exists()).toBe(false)
    reject(Object.assign(new Error('500'), { statusCode: 500, data: { detail: 'Panne' } })); await flushPromises()
    expect(w.find('[data-test="photos-loading"]').exists()).toBe(false)
    expect(w.find('[data-test="state-error"]').text()).toContain('Panne')
    expect(w.find('[data-test^="photos-stage-"]').exists()).toBe(false)
    svc.photos.mockResolvedValueOnce({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    await w.find('[data-test="state-retry"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
    expect(w.find('[data-test="photo-DEPART-0"]').exists()).toBe(true)
  })

  it('vignette en échec : jamais une image cassée silencieuse', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    await w.find('[data-test="photo-DEPART-0"] img').trigger('error')
    expect(w.find('[data-test="photo-DEPART-0"] img').exists()).toBe(false)
    expect(w.find('[data-test="photo-DEPART-0"]').text()).toContain('Photo indisponible')
  })

  it('reload_refetchesAndReopens', async () => {
    svc.photos.mockResolvedValueOnce({ bidId: 'b1', photos: [photo('d1', 'DEPART'), photo('t1', 'TRANSIT')] })
    const w = mountGallery(); await flushPromises()
    await w.find('[data-test="photo-TRANSIT-0"]').trigger('click')
    const main = document.querySelector('[data-test="photo-main"]')!
    main.dispatchEvent(new Event('error'))
    await flushPromises()
    expect(document.querySelector('[data-test="photo-error"]')).not.toBeNull()
    svc.photos.mockResolvedValueOnce({ bidId: 'b1', photos: [
      photo('d1', 'DEPART', { url: 'https://r2/d1.jpg?v=2' }), photo('t1', 'TRANSIT', { url: 'https://r2/t1.jpg?v=2' }),
    ] })
    ;(document.querySelector('[data-test="photo-reload"]') as HTMLElement).click()
    await flushPromises()
    expect(svc.photos).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[data-test="photo-error"]')).toBeNull()
    expect(mainSrc()).toBe('https://r2/t1.jpg?v=2')
    expect(w.find('[data-test="photo-TRANSIT-0"] img').attributes('src')).toBe('https://r2/t1.jpg?v=2')
  })

  it('autre colis : recharge et ferme la visionneuse', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    await w.find('[data-test="photo-DEPART-0"]').trigger('click')
    expect(document.querySelector('[data-test="photo-viewer"]')).not.toBeNull()
    await w.setProps({ bid: bid({ id: 'b2' }) }); await flushPromises()
    expect(svc.photos).toHaveBeenLastCalledWith('b2')
    expect(document.querySelector('[data-test="photo-viewer"]')).toBeNull()
  })

  it('reload sans plus aucune photo : visionneuse fermée', async () => {
    svc.photos.mockResolvedValueOnce({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    await w.find('[data-test="photo-DEPART-0"]').trigger('click')
    svc.photos.mockResolvedValueOnce({ bidId: 'b1', photos: [] })
    document.querySelector('[data-test="photo-main"]')!.dispatchEvent(new Event('error'))
    await flushPromises()
    ;(document.querySelector('[data-test="photo-reload"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('[data-test="photo-viewer"]')).toBeNull()
    expect(w.find('[data-test="photos-empty-DEPART"]').exists()).toBe(true)
  })
  it('returnFocusTo : la vignette cliquée récupère le focus', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    const tile = w.find('[data-test="photo-DEPART-0"]')
    // Safari : le clic ne donne pas le focus au bouton.
    ;(document.activeElement as HTMLElement | null)?.blur()
    await tile.trigger('click'); await flushPromises()
    ;(document.querySelector('[data-test="photo-viewer-close"]') as HTMLElement).click()
    await flushPromises()
    expect(document.activeElement).toBe(tile.element)
  })

  it('reload en échec : visionneuse fermée, erreur affichée', async () => {
    svc.photos.mockResolvedValueOnce({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    await w.find('[data-test="photo-DEPART-0"]').trigger('click')
    document.querySelector('[data-test="photo-main"]')!.dispatchEvent(new Event('error'))
    await flushPromises()
    svc.photos.mockRejectedValueOnce(Object.assign(new Error('500'), { statusCode: 500, data: { detail: 'Panne' } }))
    ;(document.querySelector('[data-test="photo-reload"]') as HTMLElement).click()
    await flushPromises()
    expect(document.querySelector('[data-test="photo-viewer"]')).toBeNull()
    expect(w.find('[data-test="state-error"]').text()).toContain('Panne')
  })

  it('autre colis pendant le reload : visionneuse non rouverte', async () => {
    svc.photos.mockResolvedValueOnce({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    await w.find('[data-test="photo-DEPART-0"]').trigger('click')
    document.querySelector('[data-test="photo-main"]')!.dispatchEvent(new Event('error'))
    await flushPromises()
    let resolveReload!: (_v: unknown) => void
    svc.photos.mockReturnValueOnce(new Promise(r => { resolveReload = r }))
    svc.photos.mockResolvedValueOnce({ bidId: 'b2', photos: [photo('e1', 'DEPART')] })
    ;(document.querySelector('[data-test="photo-reload"]') as HTMLElement).click()
    await flushPromises()
    await w.setProps({ bid: bid({ id: 'b2' }) }); await flushPromises()
    resolveReload({ bidId: 'b1', photos: [photo('d1', 'DEPART')] }); await flushPromises()
    expect(document.querySelector('[data-test="photo-viewer"]')).toBeNull()
  })

  it('legacyBackend_emitsUnavailable_andReloadAsksForFreshBid', async () => {
    svc.photos.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404, data: {} }))
    const w = mountGallery({ bid: bid({ photoUrls: ['https://r2/created.jpg'] }) }); await flushPromises()
    expect(w.emitted('unavailable')?.at(-1)).toEqual([true])
    await w.find('[data-test="photo-CREATION-0"]').trigger('click')
    document.querySelector('[data-test="photo-main"]')!.dispatchEvent(new Event('error'))
    await flushPromises()
    ;(document.querySelector('[data-test="photo-reload"]') as HTMLElement).click()
    await flushPromises()
    expect(w.emitted('reload-bid')).toHaveLength(1)
    expect(document.querySelector('[data-test="photo-viewer"]')).toBeNull()
  })

  it('endpointAvailable_doesNotEmitUnavailable', async () => {
    svc.photos.mockResolvedValue({ bidId: 'b1', photos: [photo('d1', 'DEPART')] })
    const w = mountGallery(); await flushPromises()
    expect(w.emitted('unavailable')?.some(a => a[0] === true) ?? false).toBe(false)
    expect(w.emitted('reload-bid')).toBeUndefined()
  })
})
