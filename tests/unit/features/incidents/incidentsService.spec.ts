import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { incidentsService } from '@/features/incidents/services/incidentsService'

describe('incidentsService', () => {
  beforeEach(() => apiMock.mockReset())

  it('listDisputes omits TOUS status', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await incidentsService.listDisputes('TOUS', 0, 20)
    expect(apiMock.mock.calls[0][1].query.status).toBeUndefined()
    await incidentsService.listDisputes('OPEN', 0, 20)
    expect(apiMock.mock.calls[1][1].query.status).toBe('OPEN')
  })
  it('resolveDispute POSTs resolution + note', async () => {
    apiMock.mockResolvedValue({ id: 'd1', status: 'RESOLVED' })
    await incidentsService.resolveDispute('d1', 'RESOLVED_FOR_SENDER', 'remboursé')
    expect(apiMock).toHaveBeenCalledWith('/admin/disputes/d1/resolve', { method: 'POST', body: { resolution: 'RESOLVED_FOR_SENDER', note: 'remboursé' } })
  })
  it('payGuaranteeFund POSTs amount + beneficiary + reason', async () => {
    apiMock.mockResolvedValue({ id: 'd1', status: 'RESOLVED' })
    await incidentsService.payGuaranteeFund('d1', 15000, 'u1', 'colis perdu')
    expect(apiMock).toHaveBeenCalledWith('/admin/disputes/d1/guarantee-fund', { method: 'POST', body: { amountCents: 15000, beneficiaryUserId: 'u1', reason: 'colis perdu' } })
  })
  it('payGuaranteeFund envoie la devise du colis quand elle est connue', async () => {
    apiMock.mockResolvedValue({ id: 'd1', status: 'RESOLVED' })
    await incidentsService.payGuaranteeFund('d1', 500000, 'u1', 'colis perdu', 'XOF')
    expect(apiMock).toHaveBeenCalledWith('/admin/disputes/d1/guarantee-fund', { method: 'POST', body: { amountCents: 500000, beneficiaryUserId: 'u1', reason: 'colis perdu', currency: 'XOF' } })
  })
  describe('no-shows', () => {
    const raw = {
      id: 'c1', bidId: 'b1', scope: 'HANDOVER', reason: 'SENDER_NO_SHOW', status: 'PENDING_CONFIRMATION',
      contestationDeadline: '2026-09-28T15:00:00Z', remainingMinutes: 300, createdAt: '2026-09-28T10:00:00Z',
      declarant: { userId: 't1', name: 'Awa D.', role: 'TRAVELER' }, accused: { userId: 's1', name: 'Moussa K.', role: 'SENDER' },
      trip: { departureCity: 'Bamako', arrivalCity: 'Abidjan', departureDate: '2026-09-15' },
      amount: 45, currency: 'EUR', paymentMethod: 'CASH', canConfirm: true, canReject: true,
    }
    const legacy = { id: 'c2', bidId: '89125c9c-aaaa-bbbb-cccc-dddddddddddd', cancelledBy: 'u9', reason: 'SENDER_NO_SHOW', noShowStatus: 'PENDING_CONFIRMATION', contestationDeadline: null, createdAt: '2026-09-28T10:00:00Z' }

    it('listNoShows envoie statut et portée, omet ALL, et garde noShowStatus pour l’ancien back', async () => {
      apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
      await incidentsService.listNoShows({ status: 'ALL', scope: 'ALL' }, 0, 20)
      expect(apiMock).toHaveBeenLastCalledWith('/admin/cancellations', { query: { page: 0, size: 20 } })
      await incidentsService.listNoShows({ status: 'CONTESTED', scope: 'DELIVERY' }, 2, 20)
      expect(apiMock).toHaveBeenLastCalledWith('/admin/cancellations', { query: { page: 2, size: 20, status: 'CONTESTED', noShowStatus: 'CONTESTED', scope: 'DELIVERY' } })
    })

    it('listNoShows normalise les lignes du nouveau back', async () => {
      apiMock.mockResolvedValue({ content: [raw], totalElements: 1, totalPages: 1, number: 0, size: 20 })
      const page = await incidentsService.listNoShows({ status: 'PENDING_CONFIRMATION', scope: 'ALL' }, 0, 20)
      expect(page.totalPages).toBe(1)
      expect(page.content[0]).toMatchObject({ id: 'c1', legacy: false, scope: 'HANDOVER', status: 'PENDING_CONFIRMATION', canConfirm: true, canReject: true, amount: 45, dispute: null, handoverAt: null })
    })

    it('listNoShows tolère l’ancien back : rôles déduits du motif, confirmation seulement en attente au départ, pas de rejet', async () => {
      apiMock.mockResolvedValue({ content: [
        legacy,
        { ...legacy, id: 'c3', reason: 'RECIPIENT_NO_SHOW' },
        { ...legacy, id: 'c4', reason: 'TRAVELER_DELIVERY_NO_SHOW', noShowStatus: 'CONTESTED' },
        { ...legacy, id: 'c5', reason: 'AUTRE', noShowStatus: undefined },
      ], totalElements: 4, totalPages: 1, number: 0, size: 20 })
      const { content } = await incidentsService.listNoShows({ status: 'ALL', scope: 'ALL' }, 0, 20)
      expect(content[0]).toMatchObject({ legacy: true, scope: null, status: 'PENDING_CONFIRMATION', canConfirm: true, canReject: false,
        declarant: { userId: 'u9', role: 'TRAVELER' }, accused: { role: 'SENDER' } })
      expect(content[1]).toMatchObject({ canConfirm: false, declarant: { role: 'TRAVELER' }, accused: { role: 'RECIPIENT' } })
      expect(content[2]).toMatchObject({ canConfirm: false, status: 'CONTESTED', declarant: { role: 'SENDER' }, accused: { role: 'TRAVELER' } })
      expect(content[3]).toMatchObject({ declarant: null, accused: null, status: 'PENDING_CONFIRMATION', canConfirm: false })
    })

    it('normalise une page sans contenu', async () => {
      apiMock.mockResolvedValue({ totalElements: 0, totalPages: 0, number: 0, size: 20 })
      expect((await incidentsService.listNoShows({ status: 'ALL', scope: 'ALL' }, 0, 20)).content).toEqual([])
    })

    it('confirmNoShow et rejectNoShow postent le motif et renvoient la ligne normalisée', async () => {
      apiMock.mockResolvedValue({ ...raw, status: 'CONFIRMED', canConfirm: false, canReject: false })
      const row = await incidentsService.confirmNoShow('c1', 'Absent, confirmé par téléphone')
      expect(apiMock).toHaveBeenLastCalledWith('/admin/cancellations/c1/confirm', { method: 'POST', body: { reason: 'Absent, confirmé par téléphone' } })
      expect(row).toMatchObject({ status: 'CONFIRMED', canConfirm: false })
      await incidentsService.rejectNoShow('c1', 'Remise faite, photo à l’appui')
      expect(apiMock).toHaveBeenLastCalledWith('/admin/cancellations/c1/reject', { method: 'POST', body: { reason: 'Remise faite, photo à l’appui' } })
    })

    it('confirmLegacyNoShow appelle l’ancien endpoint par bid', async () => {
      apiMock.mockResolvedValue(undefined)
      await incidentsService.confirmLegacyNoShow('b1')
      expect(apiMock).toHaveBeenCalledWith('/cancellations/bids/b1/confirm-noshow', { method: 'POST' })
    })
  })
})
