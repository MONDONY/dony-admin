import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { photoStorageService } from '@/features/photo-storage/services/photoStorageService'

describe('photoStorageService', () => {
  beforeEach(() => apiMock.mockReset())

  it('status() interroge /admin/storage/photo-purge/status', async () => {
    apiMock.mockResolvedValue({ purgeEnabled: false })
    const res = await photoStorageService.status()
    expect(apiMock).toHaveBeenCalledWith('/admin/storage/photo-purge/status')
    expect(res).toEqual({ purgeEnabled: false })
  })

  it('runPurge() POSTe sur /run', async () => {
    apiMock.mockResolvedValue({ started: true })
    await photoStorageService.runPurge()
    expect(apiMock).toHaveBeenCalledWith('/admin/storage/photo-purge/run', { method: 'POST' })
  })

  it('reconcile(false) n’envoie pas allowBulk', async () => {
    apiMock.mockResolvedValue({ started: true })
    await photoStorageService.reconcile(false)
    expect(apiMock).toHaveBeenCalledWith('/admin/storage/photo-purge/reconcile', { method: 'POST', query: {} })
  })

  it('reconcile(true) envoie allowBulk: true', async () => {
    apiMock.mockResolvedValue({ started: true })
    await photoStorageService.reconcile(true)
    expect(apiMock).toHaveBeenCalledWith('/admin/storage/photo-purge/reconcile', {
      method: 'POST',
      query: { allowBulk: true },
    })
  })
})
