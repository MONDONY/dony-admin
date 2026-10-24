import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/payments/services/paymentsService')
import { useChargebacks } from '@/features/payments/composables/useChargebacks'
import { paymentsService } from '@/features/payments/services/paymentsService'
const svc = paymentsService as any

const CB = 'cccccccc-1111-4222-8333-444444444444'
const OTHER = 'dddddddd-1111-4222-8333-444444444444'
const page = (content: object[] = []) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const cb = (id: string, over: object = {}) => ({ id, bidId: null, amountCents: 100, currency: 'EUR', reason: 'fraudulent', status: 'OPEN', openedAt: '2026-10-01T10:00:00', ...over })
const COUNTS = { open: 1, won: 4, lost: 2, all: 7 }
const missing = () => Object.assign(new Error('nf'), { statusCode: 404, data: {} })

beforeEach(() => {
  vi.clearAllMocks()
  svc.listChargebacks = vi.fn().mockResolvedValue(page([cb(CB)]))
  svc.chargebackCounts = vi.fn().mockResolvedValue(COUNTS)
})

describe('useChargebacks', () => {
  it('load : vue Ouverts quand il y en a, liste et nombres suivent la recherche', async () => {
    const c = useChargebacks()
    await c.load({ query: 'dakar' })
    expect(c.filters.view).toBe('OPEN')
    expect(svc.listChargebacks).toHaveBeenCalledWith({ view: 'OPEN', q: 'dakar', page: 0, size: 20 })
    expect(svc.chargebackCounts).toHaveBeenCalledWith('dakar')
  })
  it('aucun litige ouvert : vue Tous', async () => {
    svc.chargebackCounts.mockResolvedValue({ ...COUNTS, open: 0 })
    const c = useChargebacks()
    await c.load({})
    expect(c.filters.view).toBe('ALL')
  })
  it('?open=<litige> : ligne ouverte, vue Tous pour qu’elle soit dans la liste ; écrite dans l’URL', async () => {
    const c = useChargebacks()
    await c.load({ open: CB })
    expect(c.openId.value).toBe(CB)
    expect(c.filters.view).toBe('ALL')
    expect(c.openMissing.value).toBe(false)
    expect(c.applyUrl({ tab: 'chargebacks' })).toEqual({ tab: 'chargebacks', open: CB })
  })
  it('?open= et ?view= ensemble : la vue de l’URL est gardée', async () => {
    const c = useChargebacks()
    await c.load({ open: CB, view: 'lost' })
    expect(c.filters.view).toBe('LOST')
  })
  it('?open= qui n’est pas un UUID : ignoré', async () => {
    const c = useChargebacks()
    await c.load({ open: '<script>' })
    expect(c.openId.value).toBeNull()
  })
  it('ligne ouverte absente de la page chargée : signalée', async () => {
    const c = useChargebacks()
    await c.load({ open: OTHER })
    expect(c.openMissing.value).toBe(true)
  })
  it('page déjà ouverte : un autre ?open= ouvre l’autre ligne (vue Tous) et relit la liste', async () => {
    const c = useChargebacks()
    await c.load({})
    expect(c.filters.view).toBe('OPEN')
    await c.syncFromQuery({ tab: 'chargebacks', open: OTHER })
    expect(c.openId.value).toBe(OTHER)
    expect(c.filters.view).toBe('ALL')
    expect(svc.listChargebacks.mock.calls.at(-1)[0].view).toBe('ALL')
  })
  it('choisir une vue ou chercher referme la ligne ouverte', async () => {
    const c = useChargebacks()
    await c.load({ open: CB })
    await c.setView('WON')
    expect(c.openId.value).toBeNull()
    expect(c.applyUrl({})).toEqual({ view: 'won' })
  })
  it('ancien back : pas de vues, liste plate, colonne `open` toujours lue', async () => {
    svc.chargebackCounts.mockRejectedValue(missing())
    const c = useChargebacks()
    await c.load({ view: 'open', open: CB })
    expect(c.viewsReady.value).toBe(false)
    expect(c.filters.view).toBe('ALL')
    expect(svc.listChargebacks.mock.calls[0][0].view).toBe('ALL')
    expect(c.openId.value).toBe(CB)
  })
  it('erreur de liste : message, aucune ligne', async () => {
    svc.listChargebacks.mockRejectedValue({ data: { detail: 'Refusé' } })
    const c = useChargebacks()
    await c.load({})
    expect(c.error.value).toBe('Refusé')
    expect(c.rows.value).toEqual([])
    expect(c.openMissing.value).toBe(false)
  })
  it('params : vue, recherche et ligne ouverte', () => {
    expect(useChargebacks().params).toEqual(['query', 'view', 'open'])
  })
})
