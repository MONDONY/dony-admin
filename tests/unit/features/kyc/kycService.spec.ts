import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { kycService } from '@/features/kyc/services/kycService'
import { usersService } from '@/features/users/services/usersService'

const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

describe('kycService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listVerifications() envoie statut, pagination et omet les filtres vides', async () => {
    apiMock.mockResolvedValue(EMPTY)
    await kycService.listVerifications({ status: 'IN_REVIEW', provider: null, query: '  ', from: null, to: null }, 0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/kyc/verifications', { query: { status: 'IN_REVIEW', page: 0, size: 20 } })
  })

  it('listVerifications() envoie fournisseur, recherche et période', async () => {
    apiMock.mockResolvedValue(EMPTY)
    await kycService.listVerifications({ status: 'REJECTED', provider: 'DIDIT', query: ' awa ', from: '2026-09-01', to: '2026-09-27' }, 2, 20)
    expect(apiMock.mock.calls[0][1].query).toEqual({
      status: 'REJECTED', provider: 'DIDIT', query: 'awa', from: '2026-09-01', to: '2026-09-27', page: 2, size: 20,
    })
  })
})

describe('kycService, catalogue', () => {
  beforeEach(() => apiMock.mockReset())
  it('listRejectionCodes() lit /admin/kyc/rejection-codes', async () => {
    apiMock.mockResolvedValue(['other'])
    expect(await kycService.listRejectionCodes()).toEqual(['other'])
    expect(apiMock).toHaveBeenCalledWith('/admin/kyc/rejection-codes')
  })
})

describe('usersService, décisions KYC', () => {
  beforeEach(() => apiMock.mockReset())

  it('approveKyc() POST le motif', async () => {
    apiMock.mockResolvedValue({ userId: 'u1' })
    await usersService.approveKyc('u1', 'pièces contrôlées chez Didit')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/kyc/approve', { method: 'POST', body: { reason: 'pièces contrôlées chez Didit' } })
  })

  it('rejectKyc() POST le code et le motif', async () => {
    apiMock.mockResolvedValue({ userId: 'u1' })
    await usersService.rejectKyc('u1', 'document_expired', 'passeport expiré en 2024')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/kyc/reject', {
      method: 'POST', body: { code: 'document_expired', reason: 'passeport expiré en 2024' },
    })
  })

  it('revokeKyc() POST le code et le motif', async () => {
    apiMock.mockResolvedValue({ userId: 'u1' })
    await usersService.revokeKyc('u1', 'suspected_fraud', 'signalement de fraude confirmé par le fournisseur')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/kyc/revoke', {
      method: 'POST', body: { code: 'suspected_fraud', reason: 'signalement de fraude confirmé par le fournisseur' },
    })
  })
})
