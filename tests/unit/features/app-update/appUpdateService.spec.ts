import { describe, it, expect, vi, beforeEach } from 'vitest'

const api = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => api }))
import { appUpdateService } from '@/features/app-update/services/appUpdateService'

describe('appUpdateService', () => {
  beforeEach(() => { api.mockReset() })

  it('get lit /admin/app-update', async () => {
    api.mockResolvedValue({ recommendedBuild: 1, minSupportedBuild: 2 })
    expect(await appUpdateService.get()).toEqual({ recommendedBuild: 1, minSupportedBuild: 2 })
    expect(api).toHaveBeenCalledWith('/admin/app-update')
  })

  it('update envoie un PUT avec recommendedBuild seul', async () => {
    api.mockResolvedValue({ recommendedBuild: 1082, minSupportedBuild: 2 })
    await appUpdateService.update({ recommendedBuild: 1082 })
    expect(api).toHaveBeenCalledWith('/admin/app-update', { method: 'PUT', body: { recommendedBuild: 1082 } })
  })
})
