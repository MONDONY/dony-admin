import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'

const ID = '1c1a0000-0000-4000-8000-0000000000b2'

describe('bidsAdminService — gestes super-admin', () => {
  beforeEach(() => apiMock.mockReset())

  it('cancelBid POSTe motif et note (note vide → null)', async () => {
    apiMock.mockResolvedValue({ bidId: ID })
    await bidsAdminService.cancelBid(ID, 'SENDER_REQUEST', '')
    expect(apiMock).toHaveBeenCalledWith(`/admin/bids/${ID}/cancel`, { method: 'POST', body: { reason: 'SENDER_REQUEST', note: null } })
    await bidsAdminService.cancelBid(ID, 'OTHER', 'Doublon signalé')
    expect(apiMock).toHaveBeenLastCalledWith(`/admin/bids/${ID}/cancel`, { method: 'POST', body: { reason: 'OTHER', note: 'Doublon signalé' } })
  })

  it('openDispute POSTe la partie, le motif et la description', async () => {
    apiMock.mockResolvedValue({ disputeId: 'd1' })
    await bidsAdminService.openDispute(ID, 'TRAVELER', 'PARCEL_LOST', 'Colis introuvable')
    expect(apiMock).toHaveBeenCalledWith(`/admin/bids/${ID}/disputes`, {
      method: 'POST', body: { openedOnBehalfOf: 'TRAVELER', reason: 'PARCEL_LOST', description: 'Colis introuvable' },
    })
  })

  it('identifiant non UUID : refusé sans appel réseau', async () => {
    await expect(bidsAdminService.cancelBid('../../admin/x', 'OTHER', 'x')).rejects.toThrow('Identifiant de colis invalide')
    await expect(bidsAdminService.openDispute('b1', 'SENDER', 'OTHER', 'x')).rejects.toThrow('Identifiant de colis invalide')
    expect(apiMock).not.toHaveBeenCalled()
  })
})
