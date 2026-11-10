import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { videoModalService } from '@/features/video-modals/services/videoModalService'
import { validInput } from './fixtures'

describe('videoModalService', () => {
  beforeEach(() => apiMock.mockReset().mockResolvedValue({}))

  it('list et get', async () => {
    await videoModalService.list()
    expect(apiMock).toHaveBeenCalledWith('/admin/video-modals')
    await videoModalService.get('m1')
    expect(apiMock).toHaveBeenCalledWith('/admin/video-modals/m1')
  })

  it('create POSTe le corps du contrat', async () => {
    const input = validInput()
    await videoModalService.create(input)
    expect(apiMock).toHaveBeenCalledWith('/admin/video-modals', { method: 'POST', body: input })
  })

  it('update PUTe sans nouvelle version', async () => {
    const input = validInput()
    await videoModalService.update('m1', input)
    expect(apiMock).toHaveBeenCalledWith('/admin/video-modals/m1', { method: 'PUT', body: input })
  })

  it('publishVersion n’envoie le lien que s’il est rempli', async () => {
    await videoModalService.publishVersion('m1', { audience: 'EVERYONE' })
    expect(apiMock).toHaveBeenLastCalledWith('/admin/video-modals/m1/versions', { method: 'POST', body: { audience: 'EVERYONE' } })
    await videoModalService.publishVersion('m1', { audience: 'NEVER_ANSWERED', youtubeUrl: '   ' })
    expect(apiMock).toHaveBeenLastCalledWith('/admin/video-modals/m1/versions', { method: 'POST', body: { audience: 'NEVER_ANSWERED' } })
    await videoModalService.publishVersion('m1', { audience: 'NOT_WATCHED_PREVIOUS', youtubeUrl: ' https://youtu.be/dQw4w9WgXcQ ' })
    expect(apiMock).toHaveBeenLastCalledWith('/admin/video-modals/m1/versions', {
      method: 'POST', body: { audience: 'NOT_WATCHED_PREVIOUS', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' },
    })
  })

  it('setActive PATCHe et remove DELETE', async () => {
    await videoModalService.setActive('m1', true)
    expect(apiMock).toHaveBeenCalledWith('/admin/video-modals/m1/active', { method: 'PATCH', body: { active: true } })
    await videoModalService.remove('m1')
    expect(apiMock).toHaveBeenCalledWith('/admin/video-modals/m1', { method: 'DELETE' })
  })

  it('estimateAudience POSTe le ciblage, sans identifiant de campagne', async () => {
    const body = { conditions: null, connectedOnly: true, platforms: ['ANDROID' as const], samplePercent: 50, minAppVersion: '1.0.6', maxAppVersion: null }
    apiMock.mockResolvedValueOnce({ accounts: 10, afterSample: 5 })
    await expect(videoModalService.estimateAudience(body)).resolves.toEqual({ accounts: 10, afterSample: 5 })
    expect(apiMock).toHaveBeenCalledWith('/admin/video-modals/audience-estimate', { method: 'POST', body })
  })
})
