import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/incidents/services/incidentsService', () => {
  const listDisputesMock = vi.fn()
  return { incidentsService: { listDisputes: listDisputesMock } }
}, { spy: false })

import { useDisputes } from '@/features/incidents/composables/useDisputes'
import { incidentsService } from '@/features/incidents/services/incidentsService'

describe('useDisputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchDisputes loads page', async () => {
    vi.mocked(incidentsService.listDisputes).mockResolvedValueOnce({ content: [{ id: 'd1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const d = useDisputes(); await d.fetchDisputes()
    expect(d.disputes.value).toHaveLength(1)
  })

  it('setStatusFilter resets page', async () => {
    vi.mocked(incidentsService.listDisputes).mockResolvedValueOnce({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const d = useDisputes(); await d.goToPage(2); await d.setStatusFilter('OPEN')
    expect(d.currentPage.value).toBe(0); expect(d.statusFilter.value).toBe('OPEN')
  })

  it('captures errors', async () => {
    vi.mocked(incidentsService.listDisputes).mockRejectedValueOnce(new Error('x'))
    const d = useDisputes()
    await d.fetchDisputes()
    expect(d.error.value).toBe('x')
  })
})
