import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { exportService } from '@/features/exports/services/exportService'

describe('exportService', () => {
  beforeEach(() => apiMock.mockReset())

  it('fetchBlob hits the typed endpoint as a blob', async () => {
    const blob = new Blob(['a,b\n1,2'], { type: 'text/csv' })
    apiMock.mockResolvedValue(blob)
    await exportService.fetchBlob({ type: 'transactions', from: null, to: null })
    expect(apiMock.mock.calls[0][0]).toBe('/admin/exports/transactions')
    expect(apiMock.mock.calls[0][1].responseType).toBe('blob')
  })

  it('omits null dates and passes set dates', async () => {
    apiMock.mockResolvedValue(new Blob([]))
    await exportService.fetchBlob({ type: 'users', from: null, to: null })
    expect(apiMock.mock.calls[0][1].query).toEqual({})

    apiMock.mockReset()
    apiMock.mockResolvedValue(new Blob([]))
    await exportService.fetchBlob({ type: 'disputes', from: '2026-06-01', to: '2026-06-30' })
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ from: '2026-06-01', to: '2026-06-30' })
  })
})
