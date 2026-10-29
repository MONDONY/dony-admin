import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/topup-codes/services/topupCodesService')
import { useTopupCodes } from '@/features/topup-codes/composables/useTopupCodes'
import { topupCodesService } from '@/features/topup-codes/services/topupCodesService'
const svc = topupCodesService as any

function makeCode(id: string, displayStatus = 'ACTIVE') {
  return {
    id, code: id.toUpperCase(), amount: 2000, currency: 'XOF', maxRedemptions: 100, redeemedCount: 37,
    remaining: 63, expiresAt: '2027-01-01T00:00:00', displayStatus, note: null,
    createdAt: '2026-10-15T10:00:00', createdBy: 'a1', createdByEmail: 'admin@yadony.test', revokedAt: null,
  }
}

describe('useTopupCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue([])
    svc.create = vi.fn().mockResolvedValue({ id: 't1' })
    svc.revoke = vi.fn().mockResolvedValue({ id: 't1' })
    svc.generateCode = vi.fn().mockResolvedValue('YD-AB23-CD45')
  })

  it('fetchCodes charge la liste', async () => {
    svc.list.mockResolvedValue([makeCode('t1')])
    const t = useTopupCodes()
    await t.fetchCodes()
    expect(t.codes.value).toHaveLength(1)
  })

  it('setStatusFilter filtre côté client et revient en page 0', async () => {
    svc.list.mockResolvedValue([makeCode('t1', 'ACTIVE'), makeCode('t2', 'EXHAUSTED')])
    const t = useTopupCodes()
    await t.fetchCodes()
    t.goToPage(2)
    t.setStatusFilter('EXHAUSTED')
    expect(t.currentPage.value).toBe(0)
    expect(t.codes.value.map((c) => c.id)).toEqual(['t2'])
  })

  it('create appelle le service puis recharge', async () => {
    const t = useTopupCodes()
    const input = { code: null, amount: 10, currency: 'EUR', maxRedemptions: 1, expiresAt: null, note: null }
    const created = await t.create(input)
    expect(svc.create).toHaveBeenCalledWith(input)
    expect(created).toEqual({ id: 't1' })
    expect(svc.list).toHaveBeenCalled()
  })

  it('create échoue : error porte le detail et l’erreur remonte', async () => {
    svc.create.mockRejectedValue(Object.assign(new Error('409'), { data: { detail: 'Code déjà pris' } }))
    const t = useTopupCodes()
    await expect(t.create({ code: 'X', amount: 1, currency: 'EUR', maxRedemptions: 1, expiresAt: null, note: null }))
      .rejects.toThrow()
    expect(t.error.value).toBe('Code déjà pris')
  })

  it('revoke appelle le service puis recharge', async () => {
    const t = useTopupCodes()
    await t.revoke('t1')
    expect(svc.revoke).toHaveBeenCalledWith('t1')
    expect(svc.list).toHaveBeenCalled()
  })

  it('fetchCodes capture le detail du ProblemDetail', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('500'), { data: { detail: 'Détail lisible' } }))
    const t = useTopupCodes()
    await t.fetchCodes()
    expect(t.error.value).toBe('Détail lisible')
  })

  it('generateCode renvoie le code', async () => {
    const t = useTopupCodes()
    await expect(t.generateCode()).resolves.toBe('YD-AB23-CD45')
  })
})
