import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { overviewService } from '@/features/overview/services/overviewService'

describe('overviewService', () => {
  beforeEach(() => apiMock.mockReset())

  it('fetch() GETs /admin/metrics/overview', async () => {
    apiMock.mockResolvedValue({ users: {}, trips: {}, bids: {}, gmv: {}, queues: {} })
    await overviewService.fetch()
    expect(apiMock).toHaveBeenCalledWith('/admin/metrics/overview')
  })

  it('returns the response body', async () => {
    const data = { users: { total: 5 }, trips: {}, bids: {}, gmv: {}, queues: {} }
    apiMock.mockResolvedValue(data)
    const r = await overviewService.fetch()
    expect(r.users.total).toBe(5)
  })
})

describe('overviewService period param', () => {
  beforeEach(() => apiMock.mockReset())

  it('service_fetch_sendsPeriodParamOnlyWhenGiven', async () => {
    apiMock.mockResolvedValue({})
    await overviewService.fetch()
    expect(apiMock).toHaveBeenLastCalledWith('/admin/metrics/overview')
    expect(apiMock.mock.calls.at(-1)).toHaveLength(1)
    await overviewService.fetch('D30')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/metrics/overview', { query: { period: 'D30' } })
  })
})
