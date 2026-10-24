import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/transactions/services/transactionsService')
import { useFinanceCounts } from '@/features/transactions/composables/useFinanceCounts'
import { transactionsService } from '@/features/transactions/services/transactionsService'
const svc = transactionsService as any

describe('useFinanceCounts', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.counts = vi.fn() })
  it('reload_fillsCounts', async () => {
    svc.counts.mockResolvedValue({ payments: 3 })
    const c = useFinanceCounts(); await c.reload()
    expect(c.counts.value).toEqual({ payments: 3 }); expect(c.unavailable.value).toBe(false)
  })
  it('reload_missingEndpoint_unavailable_countsNull', async () => {
    svc.counts.mockResolvedValueOnce({ payments: 3 })
    const c = useFinanceCounts(); await c.reload()
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('nf'), { statusCode: 405, data: {} }))
    await c.reload()
    expect(c.unavailable.value).toBe(true); expect(c.counts.value).toBeNull()
  })
  it('reload_otherError_keepsPreviousCounts_noThrow', async () => {
    svc.counts.mockResolvedValueOnce({ payments: 3 })
    const c = useFinanceCounts(); await c.reload()
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
    await expect(c.reload()).resolves.toBeUndefined()
    expect(c.counts.value).toEqual({ payments: 3 }); expect(c.unavailable.value).toBe(false)
  })
  it('reload_afterUnavailable_recoversWhenBackDeployed', async () => {
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('nf'), { statusCode: 404, data: {} }))
    const c = useFinanceCounts(); await c.reload()
    svc.counts.mockResolvedValueOnce({ payments: 1 })
    await c.reload()
    expect(c.unavailable.value).toBe(false); expect(c.counts.value).toEqual({ payments: 1 })
  })
})
