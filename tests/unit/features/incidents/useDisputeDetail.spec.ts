import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/incidents/services/incidentsService', () => {
  const getDisputeMock = vi.fn()
  const resolveDisputeMock = vi.fn()
  const payGuaranteeFundMock = vi.fn()
  return { incidentsService: { getDispute: getDisputeMock, resolveDispute: resolveDisputeMock, payGuaranteeFund: payGuaranteeFundMock,
    getSplitOptions: vi.fn(), resolveDisputeWithSplit: vi.fn(), retrySplit: vi.fn() } }
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
    const d = useDisputeDetail(); await d.open('d1'); await d.payGuarantee(15000, 'u1', 'perdu', 'XOF')
    expect(vi.mocked(incidentsService.payGuaranteeFund)).toHaveBeenCalledWith('d1', 15000, 'u1', 'perdu', 'XOF')
    expect(d.dispute.value?.resolution).toBe('GUARANTEE_PAID')
  })

  it('captures action errors (e.g. 422)', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    vi.mocked(incidentsService.payGuaranteeFund).mockRejectedValueOnce(new Error('montant trop élevé'))
    const d = useDisputeDetail(); await d.open('d1'); await d.payGuarantee(99999, 'u1', 'x')
    expect(d.error.value).toBe('montant trop élevé')
  })

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    vi.mocked(incidentsService.payGuaranteeFund).mockRejectedValueOnce(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const d = useDisputeDetail(); await d.open('d1'); await d.payGuarantee(99999, 'u1', 'x')
    expect(d.error.value).toBe('Détail lisible du back')
  })

  it('open charge les options de partage d un litige ouvert, pas d un litige résolu', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    vi.mocked(incidentsService.getSplitOptions).mockResolvedValueOnce({ splittable: true, netAvailable: 100 })
    const d = useDisputeDetail(); await d.open('d1')
    expect(d.splitOptions.value?.netAvailable).toBe(100)
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd2', status: 'RESOLVED' })
    await d.open('d2')
    expect(d.splitOptions.value).toBeNull()
    expect(vi.mocked(incidentsService.getSplitOptions)).toHaveBeenCalledTimes(1)
  })

  it('options indisponibles (back antérieur) : formulaire masqué sans erreur', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    vi.mocked(incidentsService.getSplitOptions).mockRejectedValueOnce(new Error('404'))
    const d = useDisputeDetail(); await d.open('d1')
    expect(d.splitOptions.value).toBeNull()
    expect(d.error.value).toBeNull()
  })

  it('resolveWithSplit et retrySplit relaient au service', async () => {
    vi.mocked(incidentsService.getDispute).mockResolvedValueOnce({ id: 'd1', status: 'OPEN' })
    vi.mocked(incidentsService.resolveDisputeWithSplit).mockResolvedValueOnce({ id: 'd1', status: 'RESOLVED', split: { status: 'SENDER_REFUNDED' } })
    vi.mocked(incidentsService.retrySplit).mockResolvedValueOnce({ id: 'd1', status: 'RESOLVED', split: { status: 'COMPLETED' } })
    const d = useDisputeDetail(); await d.open('d1')
    await d.resolveWithSplit(30, 70, 'motif')
    expect(vi.mocked(incidentsService.resolveDisputeWithSplit)).toHaveBeenCalledWith('d1', 30, 70, 'motif')
    await d.retrySplit()
    expect(d.dispute.value?.split?.status).toBe('COMPLETED')
    d.close()
    expect(d.dispute.value).toBeNull()
  })
})
