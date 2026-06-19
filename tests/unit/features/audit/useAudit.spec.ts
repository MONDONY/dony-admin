import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/audit/services/auditService')
import { useAudit } from '@/features/audit/composables/useAudit'
import { auditService } from '@/features/audit/services/auditService'
const svc = auditService as any

describe('useAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
  })

  it('fetchAudit loads page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'e1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const a = useAudit()
    await a.fetchAudit()
    expect(a.entries.value).toHaveLength(1)
    expect(a.totalPages.value).toBe(1)
  })

  it('applyFilters resets page and reloads', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const a = useAudit()
    await a.goToPage(3)
    a.filters.action = 'USER_BANNED'
    await a.applyFilters()
    expect(a.currentPage.value).toBe(0)
    expect(svc.list).toHaveBeenCalled()
  })

  it('reset clears filters and reloads', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const a = useAudit()
    a.filters.action = 'X'; a.filters.entityType = 'Y'
    await a.reset()
    expect(a.filters.action).toBeNull()
    expect(a.filters.entityType).toBeNull()
    expect(a.currentPage.value).toBe(0)
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('audit boom'))
    const a = useAudit()
    await a.fetchAudit()
    expect(a.error.value).toBe('audit boom')
  })
})
