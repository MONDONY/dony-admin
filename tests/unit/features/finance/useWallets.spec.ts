import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/finance/services/financeService')
import { useWallets } from '@/features/finance/composables/useWallets'
import { financeService } from '@/features/finance/services/financeService'
const svc = financeService as any

const U = '11111111-2222-4333-8444-555555555555'
const page = (content: object[] = [], over: object = {}) => ({ content, totalElements: content.length, totalPages: 3, number: 0, size: 20, ...over })
const wallet = (id: string, over: object = {}) => ({ id, userId: U, balanceCents: 100, currency: 'EUR', updatedAt: '2026-10-01T10:00:00', userName: 'Awa Diallo (@awa)', ...over })

beforeEach(() => {
  vi.clearAllMocks()
  svc.listWallets = vi.fn().mockResolvedValue(page([wallet('w1')]))
})

describe('useWallets', () => {
  it('load sans paramètre : première page, filtres vides', async () => {
    const w = useWallets()
    await w.load({})
    expect(svc.listWallets).toHaveBeenCalledWith({ q: '', currency: '', balanceSign: '', partyId: '', page: 0, size: 20 })
    expect(w.rows.value).toHaveLength(1)
    expect(w.totalPages.value).toBe(3)
    expect(w.chips.value).toEqual([])
  })
  it('lien entrant ?partyId=&currency=&balanceSign=&query= : appliqué, puce « Titulaire : nom »', async () => {
    const w = useWallets()
    await w.load({ partyId: U, currency: 'XOF', balanceSign: 'NEGATIVE', query: 'awa' })
    expect(svc.listWallets.mock.calls[0][0]).toMatchObject({ q: 'awa', currency: 'XOF', balanceSign: 'NEGATIVE', partyId: U })
    expect(w.chips.value).toEqual([{ key: 'partyId', label: 'Titulaire : Awa Diallo (@awa)' }])
  })
  it('titulaire sans nom (compte supprimé, ou absent de la page) : identifiant abrégé dans la puce', async () => {
    svc.listWallets.mockResolvedValue(page([wallet('w1', { userName: undefined })]))
    const w = useWallets()
    await w.load({ partyId: U })
    expect(w.chips.value[0].label).toBe('Titulaire : 11111111')
  })
  it('valeurs inconnues ignorées : partyId non UUID, signe ou devise hors liste', async () => {
    const w = useWallets()
    await w.load({ partyId: '../x', balanceSign: 'PIRATE', currency: 'ZZZ' })
    expect(svc.listWallets.mock.calls[0][0]).toMatchObject({ partyId: '', balanceSign: '', currency: '' })
  })
  it('applyUrl : seuls les filtres non vides, les paramètres étrangers conservés', async () => {
    const w = useWallets()
    await w.load({ partyId: U, currency: 'XOF' })
    expect(w.applyUrl({ tab: 'wallets', currency: 'EUR' })).toEqual({ tab: 'wallets', partyId: U, currency: 'XOF' })
    expect(w.params).toEqual(['query', 'currency', 'balanceSign', 'partyId'])
  })
  it('changer un filtre repart de la première page ; retirer la puce efface le titulaire', async () => {
    const w = useWallets()
    await w.load({ partyId: U })
    await w.goToPage(2)
    expect(svc.listWallets.mock.calls.at(-1)[0].page).toBe(2)
    await w.setFilter('balanceSign', 'POSITIVE')
    expect(svc.listWallets.mock.calls.at(-1)[0]).toMatchObject({ balanceSign: 'POSITIVE', page: 0 })
    await w.removeChip('partyId')
    expect(svc.listWallets.mock.calls.at(-1)[0].partyId).toBe('')
    expect(w.chips.value).toEqual([])
  })
  it('erreur : message, aucune ligne gardée (jamais une liste vide trompeuse)', async () => {
    const w = useWallets()
    await w.load({})
    svc.listWallets.mockRejectedValue({ data: { detail: 'Boom' } })
    await w.setFilter('currency', 'EUR')
    expect(w.error.value).toBe('Boom')
    expect(w.rows.value).toEqual([])
  })
  it('réponse périmée : la requête la plus récente gagne', async () => {
    const w = useWallets()
    let first: (_v: unknown) => void = () => {}
    svc.listWallets.mockImplementationOnce(() => new Promise((r) => { first = r }))
    svc.listWallets.mockResolvedValueOnce(page([wallet('w2')]))
    const a = w.setFilter('currency', 'EUR')
    const b = w.setFilter('currency', 'XOF')
    await b
    first(page([wallet('w1')]))
    await a
    expect(w.rows.value.map(r => r.id)).toEqual(['w2'])
    expect(w.isLoading.value).toBe(false)
  })
  it('syncFromQuery : un autre titulaire relit la liste, la même query ne fait rien', async () => {
    const w = useWallets()
    await w.load({})
    await w.syncFromQuery({})
    expect(svc.listWallets).toHaveBeenCalledTimes(1)
    await w.syncFromQuery({ tab: 'wallets', partyId: U })
    expect(svc.listWallets).toHaveBeenCalledTimes(2)
    expect(w.filters.partyId).toBe(U)
  })
})
