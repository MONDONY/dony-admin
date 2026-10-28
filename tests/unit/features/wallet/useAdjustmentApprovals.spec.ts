import { describe, it, expect, vi, beforeEach } from 'vitest'

const listMock = vi.fn()
const approveMock = vi.fn()
const rejectMock = vi.fn()
vi.mock('@/features/wallet/services/walletService', () => ({
  walletService: {
    listAdjustmentRequests: (...a: unknown[]) => listMock(...a),
    approveAdjustmentRequest: (...a: unknown[]) => approveMock(...a),
    rejectAdjustmentRequest: (...a: unknown[]) => rejectMock(...a),
  },
}))
import { useAdjustmentApprovals } from '@/features/wallet/composables/useAdjustmentApprovals'

const REQUEST = {
  id: 'r1', userId: 'u1', currency: 'EUR', direction: 'CREDIT', amount: 150, eurEquivalent: 150,
  reason: 'Geste commercial validé', status: 'PENDING', requestedBy: 'a1', requestedByEmail: 'a@yadony.com',
  decidedBy: null, decidedByEmail: null, decidedAt: null, decisionNote: null, transactionId: null,
  createdAt: '2026-10-28T10:00:00',
}
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })

describe('useAdjustmentApprovals', () => {
  beforeEach(() => {
    listMock.mockReset(); approveMock.mockReset(); rejectMock.mockReset()
  })

  it('charge les demandes en attente', async () => {
    listMock.mockResolvedValue(page([REQUEST]))
    const a = useAdjustmentApprovals()
    await a.load(0)
    expect(listMock).toHaveBeenCalledWith('PENDING', 0, 20)
    expect(a.requests.value).toEqual([REQUEST])
    expect(a.totalPages.value).toBe(1)
  })

  it('approuve puis recharge la file', async () => {
    listMock.mockResolvedValueOnce(page([REQUEST])).mockResolvedValueOnce(page([]))
    approveMock.mockResolvedValue({})
    const a = useAdjustmentApprovals()
    await a.load(0)
    await a.approve('r1')
    expect(approveMock).toHaveBeenCalledWith('r1')
    expect(a.success.value).toContain('approuvée')
    expect(a.requests.value).toEqual([])
    expect(a.busyId.value).toBeNull()
  })

  it('refus du back (sa propre demande) : message affiché, file rechargée', async () => {
    listMock.mockResolvedValue(page([REQUEST]))
    approveMock.mockRejectedValue({ statusCode: 403, data: { code: 'wallet-adjustment-self-approval', detail: 'Approuvée par un autre admin' } })
    const a = useAdjustmentApprovals()
    await a.load(0)
    await a.approve('r1')
    expect(a.error.value).toBe('Approuvée par un autre admin')
    expect(a.success.value).toBeNull()
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('rejette avec la note', async () => {
    listMock.mockResolvedValue(page([]))
    rejectMock.mockResolvedValue({})
    const a = useAdjustmentApprovals()
    await a.reject('r1', 'Montant non justifié')
    expect(rejectMock).toHaveBeenCalledWith('r1', 'Montant non justifié')
    expect(a.success.value).toContain('rejetée')
  })
})
