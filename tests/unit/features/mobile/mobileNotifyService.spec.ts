import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { mobileNotifyService } from '@/features/mobile/services/mobileNotifyService'

describe('mobileNotifyService', () => {
  beforeEach(() => apiMock.mockReset())

  it('sendToOne: POST broadcast with a single USER target and the exact body', async () => {
    apiMock.mockResolvedValue({ id: 'b1' })
    await mobileNotifyService.sendToOne({ userId: '11111111-1111-4111-8111-111111111111', title: 'Salut', body: 'Bonjour' })
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title: 'Salut', body: 'Bonjour', target: { type: 'USER', userId: '11111111-1111-4111-8111-111111111111' }, push: true },
    })
  })

  it('exposes only sendToOne', () => {
    expect(Object.keys(mobileNotifyService)).toEqual(['sendToOne'])
  })
})
