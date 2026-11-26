import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { mobileService } from '@/features/mobile/services/mobileService'

describe('mobileService', () => {
  beforeEach(() => apiMock.mockReset())

  it('registerDevice POSTs /admin/mobile/devices with the exact body', async () => {
    apiMock.mockResolvedValue(undefined)
    await mobileService.registerDevice({ fcmToken: 't', deviceName: 'Safari sur iOS', platform: 'web' })
    expect(apiMock).toHaveBeenCalledWith('/admin/mobile/devices', {
      method: 'POST',
      body: { fcmToken: 't', deviceName: 'Safari sur iOS', platform: 'web' },
    })
  })

  it('unregisterDevice DELETEs /admin/mobile/devices with the token as query', async () => {
    apiMock.mockResolvedValue(undefined)
    await mobileService.unregisterDevice('t')
    expect(apiMock).toHaveBeenCalledWith('/admin/mobile/devices', { method: 'DELETE', query: { fcmToken: 't' } })
  })

  it('claimAlert POSTs /admin/alerts/{id}/claim', async () => {
    apiMock.mockResolvedValue({ id: 'a1' })
    await expect(mobileService.claimAlert('a1')).resolves.toEqual({ id: 'a1' })
    expect(apiMock).toHaveBeenCalledWith('/admin/alerts/a1/claim', { method: 'POST' })
  })

  it('releaseAlert DELETEs /admin/alerts/{id}/claim', async () => {
    apiMock.mockResolvedValue({ id: 'a1' })
    await mobileService.releaseAlert('a1')
    expect(apiMock).toHaveBeenCalledWith('/admin/alerts/a1/claim', { method: 'DELETE' })
  })
})
