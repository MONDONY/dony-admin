import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { usersService } from '@/features/users/services/usersService'

describe('usersService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list() requests /admin/users with filter + paging query params', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'SUSPENDED', role: null, kyc: null, pro: null, city: null, query: 'jean' }, 1, 20)
    const [url, opts] = apiMock.mock.calls[0]
    expect(url).toBe('/admin/users')
    expect(opts.query).toMatchObject({ status: 'SUSPENDED', query: 'jean', page: 1, size: 20 })
    expect(opts.query.role).toBeUndefined()
  })

  it('list() omits TOUS status', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'TOUS', role: null, kyc: null, pro: null, city: null, query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.status).toBeUndefined()
  })

  it('suspend() POSTs reason', async () => {
    apiMock.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' })
    const r = await usersService.suspend('u1', 'fraude')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/suspend', { method: 'POST', body: { reason: 'fraude' } })
    expect(r.status).toBe('SUSPENDED')
  })

  it('ban() POSTs reason', async () => {
    apiMock.mockResolvedValue({ id: 'u1', status: 'BANNED' })
    await usersService.ban('u1', 'abus')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/ban', { method: 'POST', body: { reason: 'abus' } })
  })

  it('setCommissionRate() PUTs rate', async () => {
    apiMock.mockResolvedValue({ id: 'u1' })
    await usersService.setCommissionRate('u1', 0.1)
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/commission-rate', { method: 'PUT', body: { rate: 0.1 } })
  })
})
