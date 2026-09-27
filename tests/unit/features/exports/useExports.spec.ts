import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/exports/services/exportService')
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }))
import { useExports } from '@/features/exports/composables/useExports'
import { exportService } from '@/features/exports/services/exportService'
import { downloadBlob } from '@/lib/downloadBlob'
const svc = exportService as any
const dl = downloadBlob as any

describe('useExports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.fetchBlob = vi.fn().mockResolvedValue(new Blob(['x'], { type: 'text/csv' }))
  })

  it('run fetches the blob and triggers a download with a typed filename', async () => {
    const e = useExports()
    e.filters.type = 'transactions'
    await e.run()
    expect(svc.fetchBlob).toHaveBeenCalledWith({ type: 'transactions', from: null, to: null })
    expect(dl).toHaveBeenCalledTimes(1)
    expect(dl.mock.calls[0][1]).toContain('transactions')
    expect(dl.mock.calls[0][1]).toMatch(/\.csv$/)
  })

  it('toggles isLoading around the run', async () => {
    const e = useExports()
    let during = false
    svc.fetchBlob.mockImplementation(async () => { during = e.isLoading.value; return new Blob([]) })
    await e.run()
    expect(during).toBe(true)
    expect(e.isLoading.value).toBe(false)
  })

  it('captures errors and does not download', async () => {
    svc.fetchBlob.mockRejectedValue(new Error('export boom'))
    const e = useExports()
    await e.run()
    expect(e.error.value).toBe('export boom')
    expect(dl).not.toHaveBeenCalled()
  })

  it('lit le detail du ProblemDetail reçu en Blob (réponse attendue en blob)', async () => {
    const body = new Blob([JSON.stringify({ detail: 'La période ne peut dépasser 12 mois' })], { type: 'application/problem+json' })
    svc.fetchBlob.mockRejectedValue(Object.assign(new Error('400 Bad Request'), { data: body }))
    const e = useExports()
    await e.run()
    expect(e.error.value).toBe('La période ne peut dépasser 12 mois')
    expect(dl).not.toHaveBeenCalled()
  })
})

