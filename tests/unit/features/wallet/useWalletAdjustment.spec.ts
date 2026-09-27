import { describe, it, expect, vi, beforeEach } from 'vitest'

const adjustMock = vi.fn()
vi.mock('@/features/wallet/services/walletService', () => ({
  walletService: { adjust: (...a: unknown[]) => adjustMock(...a) },
}))
let seq = 0
vi.mock('@/lib/idempotencyKey', () => ({ newIdempotencyKey: () => `key-${++seq}` }))
import { useWalletAdjustment } from '@/features/wallet/composables/useWalletAdjustment'

const REQ = { currency: 'EUR', direction: 'CREDIT' as const, amount: 5, reason: 'geste commercial validé' }
const RESULT = {
  account: { currency: 'EUR', balance: 17.5, refundEligibleAmount: 10, frozen: false },
  transaction: { id: 't9', currency: 'EUR', type: 'ADMIN_CREDIT', amount: 5, balanceAfter: 17.5, createdAt: '2026-09-27T10:00:00Z' },
}
const networkError = () => Object.assign(new Error('fetch failed'), { data: undefined })

describe('useWalletAdjustment', () => {
  beforeEach(() => { adjustMock.mockReset(); seq = 0 })

  it('begin génère une clé d’idempotence et efface l’erreur précédente', async () => {
    const a = useWalletAdjustment('u1')
    adjustMock.mockRejectedValue({ data: { detail: 'Refus' } })
    a.begin()
    expect(a.idempotencyKey.value).toBe('key-1')
    await a.submit(REQ)
    expect(a.error.value).toBe('Refus')
    a.begin()
    expect(a.idempotencyKey.value).toBe('key-2')
    expect(a.error.value).toBeNull()
  })

  it('envoie la requête avec la clé courante et rend le résultat', async () => {
    adjustMock.mockResolvedValue(RESULT)
    const a = useWalletAdjustment('u1')
    a.begin()
    const res = await a.submit(REQ)
    expect(adjustMock).toHaveBeenCalledWith('u1', REQ, 'key-1')
    expect(res).toEqual(RESULT)
    expect(a.busy.value).toBe(false)
    expect(a.error.value).toBeNull()
  })

  it('garde la même clé pour une nouvelle tentative après une erreur réseau', async () => {
    adjustMock.mockRejectedValueOnce(networkError()).mockResolvedValueOnce(RESULT)
    const a = useWalletAdjustment('u1')
    a.begin()
    expect(await a.submit(REQ)).toBeNull()
    expect(a.error.value).toBe('fetch failed')
    await a.submit({ ...REQ })
    expect(adjustMock.mock.calls[0][2]).toBe('key-1')
    expect(adjustMock.mock.calls[1][2]).toBe('key-1')
  })

  it('génère une nouvelle clé après un succès', async () => {
    adjustMock.mockResolvedValue(RESULT)
    const a = useWalletAdjustment('u1')
    a.begin()
    await a.submit(REQ)
    expect(a.idempotencyKey.value).toBe('key-2')
    await a.submit(REQ)
    expect(adjustMock.mock.calls[1][2]).toBe('key-2')
  })

  it('une demande modifiée après un échec prend une nouvelle clé (sinon 409 de conflit)', async () => {
    adjustMock.mockRejectedValueOnce({ statusCode: 422, data: { detail: 'Plafond dépassé' } }).mockResolvedValueOnce(RESULT)
    const a = useWalletAdjustment('u1')
    a.begin()
    await a.submit({ ...REQ, amount: 900 })
    expect(a.error.value).toBe('Plafond dépassé')
    await a.submit(REQ)
    expect(adjustMock.mock.calls[0][2]).toBe('key-1')
    expect(adjustMock.mock.calls[1][2]).toBe('key-2')
  })

  it('submit sans begin préalable crée tout de même une clé', async () => {
    adjustMock.mockResolvedValue(RESULT)
    const a = useWalletAdjustment('u1')
    await a.submit(REQ)
    expect(adjustMock.mock.calls[0][2]).toBe('key-1')
  })

  it('message de repli quand l’erreur ne dit rien', async () => {
    adjustMock.mockRejectedValue({})
    const a = useWalletAdjustment('u1')
    a.begin()
    await a.submit(REQ)
    expect(a.error.value).toBe('La correction du solde a échoué')
  })
})
