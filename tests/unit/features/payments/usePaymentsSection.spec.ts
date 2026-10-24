import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'

const replace = vi.fn(async (to: { query: Record<string, unknown> }) => { route.query = to.query })
const route: { query: Record<string, unknown> } = { query: {} }
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => ({ replace }))

vi.mock('@/features/payments/services/paymentsService')
import { paymentsService } from '@/features/payments/services/paymentsService'
import { usePaymentsSection } from '@/features/payments/composables/usePaymentsSection'
const svc = paymentsService as any

const U1 = '11111111-1111-4111-8111-111111111111'
const page = (content: unknown[] = []) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const COUNTS = { attention: 2, escrow: 5, releasedRecent: 1, refunded: 0, failed: 0, all: 9, abandoned: 23, alerts: { held: 1, chargebackOpen: 0, mmFailed: 0, escrowJ48: 1 } }
const missing = () => Object.assign(new Error('nf'), { statusCode: 404, data: {} })

let scope: ReturnType<typeof effectScope>
function make(query: Record<string, unknown> = {}, opts: { active?: () => boolean } = {}) {
  route.query = query
  scope = effectScope()
  return scope.run(() => usePaymentsSection(opts))!
}
const lastList = () => svc.list.mock.calls.at(-1)[0]

describe('usePaymentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    svc.list = vi.fn().mockResolvedValue(page())
    svc.summary = vi.fn().mockResolvedValue([])
    svc.counts = vi.fn().mockResolvedValue(COUNTS)
    svc.suggest = vi.fn().mockResolvedValue({ senders: [], travelers: [], trips: [], parcels: [] })
  })
  afterEach(() => { scope?.stop(); vi.useRealTimers() })

  it('URL sans paramètre : vue À traiter, liste et nombres chargés, rien écrit', async () => {
    const s = make()
    expect(s.filters.view).toBe('ATTENTION')
    await s.load()
    expect(svc.list).toHaveBeenCalledTimes(1); expect(svc.counts).toHaveBeenCalledTimes(1)
    expect(s.viewsReady.value).toBe(true)
    expect(s.hiddenAbandoned.value).toBe(23)
    await nextTick()
    expect(replace).not.toHaveBeenCalled()
  })

  it('URL : UUID et montants (unités principales → centimes), vue Tous', () => {
    const s = make({ partyId: U1, bidId: 'pas-un-uuid', amountMin: '100', tab: 'payments' })
    expect(s.filters).toMatchObject({ partyId: U1, bidId: '', amountMin: 10000, view: 'ALL' })
  })

  it('?held=true : alerte HELD + À traiter, `held` retiré de l’URL (tab et open gardés)', async () => {
    const s = make({ held: 'true', tab: 'wallet-refunds', open: U1 })
    expect(s.filters).toMatchObject({ view: 'ATTENTION', alert: 'HELD' })
    expect(s.held.value).toBe(true)
    await s.load()
    expect(replace).toHaveBeenCalledWith({ query: { tab: 'wallet-refunds', open: U1, alert: 'HELD', view: 'ATTENTION' } })
    expect(lastList()).toMatchObject({ alert: 'HELD', view: 'ATTENTION' })
  })

  it('?held=false : simplement retiré', async () => {
    const s = make({ held: 'false' })
    await s.load()
    expect(replace).toHaveBeenCalledWith({ query: {} })
    expect(s.filters.alert).toBeNull()
  })

  it('page déjà ouverte : un ?held=true arrivé ensuite est converti et relu', async () => {
    const s = make()
    await s.load()
    route.query = { held: 'true' }
    await s.applyLegacyHeld()
    expect(s.filters).toMatchObject({ view: 'ATTENTION', alert: 'HELD' })
    expect(route.query).toEqual({ alert: 'HELD', view: 'ATTENTION' })
    expect(lastList()).toMatchObject({ alert: 'HELD' })
    // Sans `held` dans l'URL : rien à faire.
    const calls = svc.list.mock.calls.length
    await s.applyLegacyHeld()
    expect(svc.list.mock.calls.length).toBe(calls)
  })

  it('les filtres s’écrivent dans l’URL (montants en unités principales), tab/open préservés', async () => {
    const s = make({ tab: 'payments', open: U1 })
    await s.load()
    await s.setAmountRange(12550, null)
    await nextTick()
    expect(route.query).toEqual({ tab: 'payments', open: U1, amountMin: '125.5', view: 'ATTENTION' })
  })

  it('nombres resynchronisés quand un filtre de périmètre change, pas pour la vue', async () => {
    const s = make()
    await s.load()
    await s.setView('ESCROW'); await flushPromises()
    expect(svc.counts).toHaveBeenCalledTimes(1)
    await s.setMethodFilter('STRIPE'); await flushPromises()
    expect(svc.counts).toHaveBeenCalledTimes(2)
  })

  it('ancien back (nombres absents) : vues masquées, vue Tous, alerte autre que HELD retirée, aucun nombre', async () => {
    svc.counts.mockRejectedValue(missing())
    const s = make({ alert: 'ESCROW_J48' })
    await s.load(); await nextTick()
    expect(s.viewsReady.value).toBe(false)
    expect(s.filters.view).toBe('ALL')
    expect(s.filters.alert).toBeNull()
    expect(s.hiddenAbandoned.value).toBe(0)
    await nextTick()
    // La vue Tous est le défaut face à un ancien back : pas de `view` dans l'URL.
    expect(route.query).toEqual({})
    await s.setMethodFilter('STRIPE'); await flushPromises()
    expect(svc.counts).toHaveBeenCalledTimes(1)
  })

  it('ancien back + ?held=true : l’alerte HELD reste (envoyée aussi en held=true par le service)', async () => {
    svc.counts.mockRejectedValue(missing())
    const s = make({ held: 'true' })
    await s.load(); await nextTick()
    expect(s.filters).toMatchObject({ view: 'ALL', alert: 'HELD' })
    expect(s.held.value).toBe(true)
  })

  it('nombres en erreur : signalée, pas une indisponibilité', async () => {
    svc.counts.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne' } }))
    const s = make()
    await s.load()
    expect(s.countsApi.error.value).toBe('Panne')
    expect(s.viewsReady.value).toBe(true)
    expect(s.hiddenAbandoned.value).toBe(0)
  })

  it('checkouts abandonnés : nombre seulement s’ils sont masqués ; « les afficher » les montre', async () => {
    const s = make()
    await s.load()
    await s.showAbandoned()
    expect(s.filters.hideAbandoned).toBe(false)
    expect(s.hiddenAbandoned.value).toBe(0)
    expect(lastList().hideAbandoned).toBe(false)
  })

  it('Versements retenus : bascule sur l’alerte HELD ; vue hors À traiter/Tous ramenée sur À traiter', async () => {
    const s = make()
    await s.load()
    await s.setView('REFUNDED')
    await s.setHeld(true)
    expect(s.filters).toMatchObject({ alert: 'HELD', view: 'ATTENTION' })
    expect(s.held.value).toBe(true)
    await s.setView('ALL')
    await s.setHeld(true)
    expect(s.filters.view).toBe('ALL')
    await s.setHeld(false)
    expect(s.filters.alert).toBeNull(); expect(s.held.value).toBe(false)
  })

  it('suggestions : frappe transmise, choix d’une personne → partyId + libellé de puce, recherche vidée', async () => {
    const s = make()
    await s.load()
    s.onType('awa')
    await vi.advanceTimersByTimeAsync(200)
    expect(svc.suggest).toHaveBeenCalledWith('awa')
    const key = s.searchResetKey.value
    const opened = await s.onPick('sender', { id: U1, name: 'Awa Diallo', count: 3 })
    expect(opened).toBeNull()
    expect(s.filters).toMatchObject({ partyId: U1, query: '' })
    expect(s.chips.value).toEqual([{ key: 'party', label: 'Personne : Awa Diallo' }])
    expect(s.searchResetKey.value).toBe(key + 1)
    expect(lastList().partyId).toBe(U1)
    await s.removeChip('party')
    expect(s.filters.partyId).toBe('')
    expect(s.chips.value).toEqual([])
  })

  it('choix d’un voyageur aussi ; d’un trajet → recherche « Paris Dakar » ; d’un n° de suivi → paiement à ouvrir', async () => {
    const s = make()
    await s.load()
    await s.onPick('traveler', { id: U1, name: 'Moussa', count: 1 })
    expect(s.filters.partyId).toBe(U1)
    await s.onPick('trip', { label: 'Paris → Dakar', departureCity: 'Paris', arrivalCity: 'Dakar', count: 4 })
    expect(s.filters.query).toBe('Paris Dakar')
    const calls = svc.list.mock.calls.length
    expect(await s.onPick('parcel', { paymentId: 'p9', trackingNumber: 'YD-1', status: 'ESCROW', amountCents: 1, currency: 'EUR' })).toBe('p9')
    expect(svc.list.mock.calls.length).toBe(calls)
  })

  it('référence exacte : ouverte seulement si le texte tapé est celui auquel les suggestions ont répondu', async () => {
    svc.suggest.mockResolvedValue({ exactPaymentId: 'p9', senders: [], travelers: [], trips: [], parcels: [] })
    const s = make()
    await s.load()
    s.onType('pi_1'); await vi.advanceTimersByTimeAsync(200)
    expect(await s.onOpenPayment('p9')).toBe('p9')
    // Texte changé avant la réponse suivante : recherche libre, pas d'ouverture périmée.
    s.onType('pi_12')
    expect(await s.onOpenPayment('p9')).toBeNull()
    expect(s.filters.query).toBe('pi_12')
  })

  it('recherche validée : requête appliquée, suggestions effacées ; suggestions indisponibles : aucune requête', async () => {
    const s = make()
    await s.load()
    await s.onSearch('awa')
    expect(s.filters.query).toBe('awa')
    svc.suggest.mockRejectedValue(missing())
    s.onType('aw'); await vi.advanceTimersByTimeAsync(200)
    expect(s.suggestApi.unavailable.value).toBe(true)
    s.onType('awa'); await vi.advanceTimersByTimeAsync(200)
    expect(svc.suggest).toHaveBeenCalledTimes(1)
  })

  it('puces : retrait d’un filtre, alerte HELD comprise ; tout effacer revient aux défauts', async () => {
    const s = make({ held: 'true', currency: 'XOF' })
    await s.load()
    expect(s.chips.value.map(c => c.key)).toEqual(['alert', 'currency'])
    await s.removeChip('alert')
    expect(s.filters.alert).toBeNull()
    await s.onPick('sender', { id: U1, name: 'Awa', count: 1 })
    await s.clearAll()
    expect(s.filters).toMatchObject({ currency: 'TOUTES', partyId: '', view: 'ATTENTION', hideAbandoned: true })
    expect(s.chips.value).toEqual([])
  })

  it('tout effacer face à un ancien back : vue Tous', async () => {
    svc.counts.mockRejectedValue(missing())
    const s = make({ currency: 'XOF' })
    await s.load(); await nextTick()
    await s.clearAll()
    expect(s.filters.view).toBe('ALL')
  })

  it('refresh après un geste : liste et nombres relus (pas les nombres d’un ancien back)', async () => {
    const s = make()
    await s.load()
    await s.refresh()
    expect(svc.list).toHaveBeenCalledTimes(2); expect(svc.counts).toHaveBeenCalledTimes(2)
    svc.counts.mockRejectedValue(missing())
    await s.refresh(); await s.refresh()
    expect(svc.counts).toHaveBeenCalledTimes(3)
  })
})

describe('usePaymentsSection : périmètre de l’URL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue(page())
    svc.summary = vi.fn().mockResolvedValue([])
    svc.counts = vi.fn().mockResolvedValue(COUNTS)
    svc.suggest = vi.fn().mockResolvedValue({ senders: [], travelers: [], trips: [], parcels: [] })
  })
  afterEach(() => { scope?.stop() })

  it('?tab=mobile-money : view/query de Mobile money ne deviennent pas des filtres de Paiements', () => {
    const s = make({ tab: 'mobile-money', view: 'failed', query: 'awa', kind: 'PAYOUT' })
    expect(s.filters.query).toBe('')
    expect(s.filters.view).toBe('ATTENTION')
  })
  it('?tab=payments garde ses filtres', () => {
    const s = make({ tab: 'payments', view: 'ESCROW', query: 'awa' })
    expect(s.filters.query).toBe('awa')
    expect(s.filters.view).toBe('ESCROW')
  })
  it('section inactive (autre onglet) : un changement de filtre n’écrit pas l’URL de l’autre section', async () => {
    const s = make({ tab: 'mobile-money', view: 'failed' }, { active: () => false })
    await nextTick()
    s.filters.view = 'ALL'
    await nextTick()
    expect(replace).not.toHaveBeenCalled()
  })
})
