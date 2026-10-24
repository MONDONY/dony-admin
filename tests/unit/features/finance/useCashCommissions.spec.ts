import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/finance/services/financeService')
import { useCashCommissions } from '@/features/finance/composables/useCashCommissions'
import { financeService } from '@/features/finance/services/financeService'
const svc = financeService as any

const T = '22222222-3333-4444-8555-666666666666'
const page = (content: object[] = []) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const row = (bidId: string, over: object = {}) => ({ bidId, amountCents: 100, commissionCents: 12, currency: 'EUR', status: 'FAILED', chargedVia: 'CARD', retryCount: 1, createdAt: '2026-10-01T10:00:00', travelerId: T, travelerName: 'Oumar Keita', ...over })
const missing = () => Object.assign(new Error('nf'), { statusCode: 404, data: {} })

beforeEach(() => {
  vi.clearAllMocks()
  svc.listCashCommissions = vi.fn().mockResolvedValue(page([row('b1')]))
  svc.cashCommissionCounts = vi.fn().mockResolvedValue({ attention: 2, all: 9 })
})

describe('useCashCommissions', () => {
  it('load : vue À traiter quand il y en a ; nombres sans vue ni statut', async () => {
    const c = useCashCommissions()
    await c.load({})
    expect(c.filters.view).toBe('ATTENTION')
    expect(c.viewsReady.value).toBe(true)
    expect(svc.listCashCommissions).toHaveBeenCalledWith({ view: 'ATTENTION', status: '', q: '', partyId: '', page: 0, size: 20 })
    expect(svc.cashCommissionCounts).toHaveBeenCalledWith({ q: '', partyId: '' })
  })
  it('rien à traiter : vue Toutes', async () => {
    svc.cashCommissionCounts.mockResolvedValue({ attention: 0, all: 9 })
    const c = useCashCommissions()
    await c.load({})
    expect(c.filters.view).toBe('ALL')
  })
  it('la vue de l’URL gagne (minuscules), avec statut, recherche et voyageur', async () => {
    const c = useCashCommissions()
    await c.load({ view: 'all', status: 'CHARGED', query: 'YD-1', partyId: T })
    expect(c.filters).toMatchObject({ view: 'ALL', status: 'CHARGED', query: 'YD-1', partyId: T })
    expect(svc.cashCommissionCounts).toHaveBeenCalledWith({ q: 'YD-1', partyId: T })
    expect(c.chips.value).toEqual([{ key: 'partyId', label: 'Voyageur : Oumar Keita' }])
    expect(c.applyUrl({ tab: 'cash-commissions' })).toEqual({ tab: 'cash-commissions', status: 'CHARGED', query: 'YD-1', partyId: T })
  })
  it('applyUrl écrit la vue en minuscules quand elle n’est pas Toutes', async () => {
    const c = useCashCommissions()
    await c.load({})
    expect(c.applyUrl({})).toEqual({ view: 'attention' })
  })
  it('ancien back : nombres absents => pas de vues, liste Toutes', async () => {
    svc.cashCommissionCounts.mockRejectedValue(missing())
    const c = useCashCommissions()
    await c.load({ view: 'attention' })
    expect(c.unavailable.value).toBe(true)
    expect(c.viewsReady.value).toBe(false)
    expect(c.filters.view).toBe('ALL')
    expect(c.applyUrl({})).toEqual({})
  })
  it('nombres en erreur au chargement : Toutes + erreur ; plus tard, les nombres précédents restent', async () => {
    svc.cashCommissionCounts.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Oups' } })
    const c = useCashCommissions()
    await c.load({})
    expect(c.filters.view).toBe('ALL')
    expect(c.countsError.value).toBe('Oups')
    await c.reload()
    expect(c.countsError.value).toBeNull()
    expect(c.counts.value).toEqual({ attention: 2, all: 9 })
    svc.cashCommissionCounts.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Oups' } })
    await c.setFilter('query', 'abc')
    expect(c.counts.value).toEqual({ attention: 2, all: 9 })
    expect(c.viewsReady.value).toBe(true)
    expect(c.countsError.value).toBe('Oups')
  })
  it('la recherche relit les nombres, le statut et la vue non', async () => {
    const c = useCashCommissions()
    await c.load({})
    await c.setFilter('status', 'FAILED')
    await c.setView('ALL')
    expect(svc.cashCommissionCounts).toHaveBeenCalledTimes(1)
    await c.setFilter('query', 'dakar')
    expect(svc.cashCommissionCounts).toHaveBeenCalledTimes(2)
    expect(svc.listCashCommissions.mock.calls.at(-1)[0]).toMatchObject({ view: 'ALL', status: 'FAILED', q: 'dakar', page: 0 })
  })
  it('un choix de vue identique ne relit rien', async () => {
    const c = useCashCommissions()
    await c.load({})
    await c.setView('ATTENTION')
    expect(svc.listCashCommissions).toHaveBeenCalledTimes(1)
  })
  it('voyageur sans nom : identifiant abrégé dans la puce', async () => {
    svc.listCashCommissions.mockResolvedValue(page([]))
    const c = useCashCommissions()
    await c.load({ partyId: T })
    expect(c.chips.value[0].label).toBe('Voyageur : 22222222')
    await c.clearChips()
    expect(c.filters.partyId).toBe('')
  })
})
