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

  it('exposes only the two device calls', () => {
    expect(Object.keys(mobileService).sort()).toEqual(['registerDevice', 'unregisterDevice'])
  })
})
