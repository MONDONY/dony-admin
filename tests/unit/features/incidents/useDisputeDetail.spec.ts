import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/incidents/services/incidentsService', () => {
  const getDisputeMock = vi.fn()
  const resolveDisputeMock = vi.fn()
  const payGuaranteeFundMock = vi.fn()
  return { incidentsService: { getDispute: getDisputeMock, resolveDispute: resolveDisputeMock, payGuaranteeFund: payGuaranteeFundMock } }
}, { spy: false })

import { useDisputeDetail } from '@/features/incidents/composables/useDisputeDetail'
import { incidentsService } from '@/features/incidents/services/incidentsService'

describe('useDisputeDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('open loads dispute', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    const d = useDisputeDetail(); await d.open('d1')
    expect(d.dispute.value?.id).toBe('d1')
  })

  it('resolve calls service + refreshes', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    vi.mocked(incidentsService.resolveDispute).mockResolvedValueOnce({ id: 'd1', status: 'RESOLVED', resolution: 'DISMISSED' })
    const d = useDisputeDetail(); await d.open('d1'); await d.resolve('DISMISSED', 'rien')
    expect(vi.mocked(incidentsService.resolveDispute)).toHaveBeenCalledWith('d1', 'DISMISSED', 'rien')
    expect(d.dispute.value?.status).toBe('RESOLVED')
  })

  it('payGuarantee calls service + refreshes', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    vi.mocked(incidentsService.payGuaranteeFund).mockResolvedValueOnce({ id: 'd1', status: 'RESOLVED', resolution: 'GUARANTEE_PAID' })
    const d = useDisputeDetail(); await d.open('d1'); await d.payGuarantee(15000, 'u1', 'perdu')
    expect(vi.mocked(incidentsService.payGuaranteeFund)).toHaveBeenCalledWith('d1', 15000, 'u1', 'perdu')
    expect(d.dispute.value?.resolution).toBe('GUARANTEE_PAID')
  })

  it('captures action errors (e.g. 422)', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    vi.mocked(incidentsService.payGuaranteeFund).mockRejectedValueOnce(new Error('montant trop élevé'))
    const d = useDisputeDetail(); await d.open('d1'); await d.payGuarantee(99999, 'u1', 'x')
    expect(d.error.value).toBe('montant trop élevé')
  })
})
