import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { auditService } from '@/features/audit/services/auditService'

describe('auditService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list omits null filters', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await auditService.list({ action: null, entityType: null, actorId: null, from: null, to: null }, 0, 20)
    const q = apiMock.mock.calls[0][1].query
    expect(q).toMatchObject({ page: 0, size: 20 })
    expect(q.action).toBeUndefined()
    expect(q.entityType).toBeUndefined()
    expect(q.actorId).toBeUndefined()
    expect(q.from).toBeUndefined()
    expect(q.to).toBeUndefined()
  })

  it('list passes set filters', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await auditService.list(
      { action: 'USER_SUSPENDED', entityType: 'USER', actorId: 'a1', from: '2026-06-01', to: '2026-06-30' },
      1, 20,
    )
    expect(apiMock.mock.calls[0][1].query).toMatchObject({
      action: 'USER_SUSPENDED', entityType: 'USER', actorId: 'a1', from: '2026-06-01', to: '2026-06-30', page: 1, size: 20,
    })
    expect(apiMock.mock.calls[0][0]).toBe('/admin/audit-log')
  })
})
