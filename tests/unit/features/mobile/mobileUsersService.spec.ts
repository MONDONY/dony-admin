import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { mobileUsersService } from '@/features/mobile/services/mobileUsersService'

describe('mobileUsersService', () => {
  beforeEach(() => { apiMock.mockReset(); apiMock.mockResolvedValue({ content: [] }) })

  it('list: GET /admin/users, first page, trimmed query, every status', async () => {
    await mobileUsersService.list('  Aïcha ', 5)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/users', { query: { page: 0, size: 5, query: 'Aïcha' } })
  })

  it('get: GET /admin/users/{id}, the id encoded', async () => {
    await mobileUsersService.get('../x')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/users/..%2Fx')
  })

  it('exposes exactly the two GET calls', () => {
    expect(Object.keys(mobileUsersService).sort()).toEqual(['get', 'list'])
  })
})
