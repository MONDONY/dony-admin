import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/bids/services/bidsAdminService')
import { reactive } from 'vue'
import { useBidCounts } from '@/features/bids/composables/useBidCounts'
import { bidsAdminService } from '@/features/bids/services/bidsAdminService'
import type { AdminBidCounts, BidsFilterState } from '@/features/bids/types/index'
const svc = bidsAdminService as any

const counts = (all: number): AdminBidCounts => ({ todo: 1, active: 2, recent: 3, completed: 4, closed: 5, all, alerts: { disputeOpen: 0, noShow: 0, paymentPending: 0, late: 0 } })
const filters = () => reactive<BidsFilterState>({ status: 'TOUS', announcementId: null, query: '', scope: 'ALL', view: 'ALL', paymentMethod: null, content: '', alert: null, dateFrom: null, dateTo: null })

describe('useBidCounts', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.counts = vi.fn() })
  it('reload_fillsCounts', async () => {
    svc.counts.mockResolvedValue(counts(15))
    const f = filters(); const c = useBidCounts(f); await c.reload()
    expect(c.counts.value?.all).toBe(15); expect(c.unavailable.value).toBe(false); expect(c.error.value).toBeNull()
    expect(svc.counts).toHaveBeenCalledWith(f)
  })
  it('reload_missingEndpoint_marksUnavailable_noError', async () => {
    svc.counts.mockResolvedValueOnce(counts(15))
    const c = useBidCounts(filters()); await c.reload()
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('nf'), { statusCode: 404, data: {} }))
    await c.reload()
    expect(c.unavailable.value).toBe(true); expect(c.counts.value).toBeNull(); expect(c.error.value).toBeNull()
  })
  it('reload_otherError_keepsPreviousCounts', async () => {
    svc.counts.mockResolvedValueOnce(counts(15))
    const c = useBidCounts(filters()); await c.reload()
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
    await c.reload()
    expect(c.counts.value?.all).toBe(15); expect(c.error.value).toBeTruthy(); expect(c.unavailable.value).toBe(false)
  })
  it('reload_ignoresStaleResponse', async () => {
    let resolveFirst!: (_v: unknown) => void
    svc.counts.mockReturnValueOnce(new Promise(r => { resolveFirst = r }))
    svc.counts.mockResolvedValueOnce(counts(2))
    const c = useBidCounts(filters())
    const first = c.reload(); const second = c.reload()
    await second; resolveFirst(counts(1)); await first
    expect(c.counts.value?.all).toBe(2)
  })
  it('sync_reloadsOnlyWhenCommonFiltersChange', async () => {
    svc.counts.mockResolvedValue(counts(3))
    const f = filters(); const c = useBidCounts(f)
    await c.sync(); await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(1)
    f.view = 'TODO'; f.status = 'COMPLETED'; f.alert = 'LATE'
    await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(1)
    f.query = 'Awa'
    await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(2)
    await c.reload()
    expect(svc.counts).toHaveBeenCalledTimes(3)
  })

  it('settled_afterFirstAnswer_evenOnError', async () => {
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
    const c = useBidCounts(filters())
    expect(c.settled.value).toBe(false)
    const p = c.reload()
    expect(c.settled.value).toBe(false)
    await p
    expect(c.settled.value).toBe(true)
  })
  it('sync_retriesAfterError', async () => {
    svc.counts.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
    svc.counts.mockResolvedValueOnce(counts(9))
    const c = useBidCounts(filters())
    await c.sync()
    expect(c.error.value).toBeTruthy()
    await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(2)
    expect(c.counts.value?.all).toBe(9); expect(c.error.value).toBeNull()
  })
  it('sync_scopeWithoutQuery_noReload', async () => {
    svc.counts.mockResolvedValue(counts(3))
    const f = filters(); const c = useBidCounts(f)
    await c.sync()
    f.scope = 'TRIP'
    await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(1)
    f.query = 'Paris'
    await c.sync()
    expect(svc.counts).toHaveBeenCalledTimes(2)
  })
})
