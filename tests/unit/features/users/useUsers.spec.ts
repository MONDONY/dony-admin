import { describe, it, expect, vi, beforeEach } from 'vitest'

const listMock = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({ usersService: { list: (...a: unknown[]) => listMock(...a) } }))

import { useUsers } from '@/features/users/composables/useUsers'

describe('useUsers', () => {
  beforeEach(() => listMock.mockReset())

  it('fetchUsers loads page data', async () => {
    listMock.mockResolvedValue({ content: [{ id: 'u1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const u = useUsers()
    await u.fetchUsers()
    expect(u.users.value).toHaveLength(1)
    expect(u.totalElements.value).toBe(1)
    expect(u.isLoading.value).toBe(false)
  })

  it('setStatusFilter resets to page 0 and refetches', async () => {
    listMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const u = useUsers()
    await u.goToPage(2)
    await u.setStatusFilter('BANNED')
    expect(u.currentPage.value).toBe(0)
    expect(u.filters.status).toBe('BANNED')
  })

  it('captures errors', async () => {
    listMock.mockRejectedValueOnce(new Error('boom'))
    const u = useUsers()
    await u.fetchUsers()
    expect(u.error.value).toBe('boom')
    expect(u.isLoading.value).toBe(false)
  })
})
