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
  it('reload_otherError_setsError_clearedOnSuccess', async () => {
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne' } }))
    const c = useFinanceCounts(); await c.reload()
    expect(c.error.value).toBe('Panne'); expect(c.counts.value).toBeNull(); expect(c.unavailable.value).toBe(false)
    svc.counts.mockResolvedValueOnce({ payments: 2 })
    await c.reload()
    expect(c.error.value).toBeNull(); expect(c.counts.value).toEqual({ payments: 2 })
  })
  it('reload_missingEndpoint_isNotAnError', async () => {
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('nf'), { statusCode: 404, data: {} }))
    const c = useFinanceCounts(); await c.reload()
    expect(c.error.value).toBeNull()
  })
  it('reload_overlapping_lastCallWins', async () => {
    let first!: (_v: unknown) => void
    svc.counts.mockImplementationOnce(() => new Promise((r) => { first = r }))
    svc.counts.mockResolvedValueOnce({ payments: 9 })
    const c = useFinanceCounts()
    const a = c.reload(); const b = c.reload()
    await b
    first({ payments: 1 }); await a
    expect(c.counts.value).toEqual({ payments: 9 })
  })
  it('reload_overlapping_staleErrorIgnored', async () => {
    let fail!: (_e: unknown) => void
    svc.counts.mockImplementationOnce(() => new Promise((_, r) => { fail = r }))
    svc.counts.mockResolvedValueOnce({ payments: 4 })
    const c = useFinanceCounts()
    const a = c.reload(); await c.reload()
    fail(Object.assign(new Error('nf'), { statusCode: 404, data: {} })); await a
    expect(c.unavailable.value).toBe(false); expect(c.counts.value).toEqual({ payments: 4 }); expect(c.error.value).toBeNull()
  })
})
