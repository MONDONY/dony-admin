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
  it('listCancellations maps ALL→no filter, else noShowStatus', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await incidentsService.listCancellations('ALL', 0, 20)
    expect(apiMock.mock.calls[0][1].query.noShowStatus).toBeUndefined()
    await incidentsService.listCancellations('CONTESTED', 0, 20)
    expect(apiMock.mock.calls[1][1].query.noShowStatus).toBe('CONTESTED')
  })
  it('confirmNoShow POSTs to the cancellations endpoint', async () => {
    apiMock.mockResolvedValue({})
    await incidentsService.confirmNoShow('b1')
    expect(apiMock).toHaveBeenCalledWith('/cancellations/bids/b1/confirm-noshow', { method: 'POST' })
  })
})
