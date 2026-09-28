import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { notificationsService } from '@/features/notifications/services/notificationsService'

describe('notificationsService', () => {
  beforeEach(() => apiMock.mockReset().mockResolvedValue({}))

  it('feed : GET /admin/notifications/feed avec limit, et before seulement s’il est fourni', async () => {
    await notificationsService.feed({ limit: 30 })
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/feed', { query: { limit: 30 } })
    await notificationsService.feed({ limit: 30, before: '2026-09-28T10:00:00Z' })
    expect(apiMock).toHaveBeenLastCalledWith('/admin/notifications/feed', { query: { limit: 30, before: '2026-09-28T10:00:00Z' } })
  })

  it('counters : GET /admin/notifications/counters', async () => {
    await notificationsService.counters()
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/counters')
  })

  it('markSeen : POST /admin/notifications/mark-seen, upTo optionnel', async () => {
    await notificationsService.markSeen('2026-09-28T10:00:00Z')
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/mark-seen', { method: 'POST', body: { upTo: '2026-09-28T10:00:00Z' } })
    await notificationsService.markSeen()
    expect(apiMock).toHaveBeenLastCalledWith('/admin/notifications/mark-seen', { method: 'POST', body: {} })
  })
})
