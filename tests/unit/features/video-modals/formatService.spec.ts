import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { videoModalService } from '@/features/video-modals/services/videoModalService'

describe('videoModalService : image', () => {
  beforeEach(() => apiMock.mockReset().mockResolvedValue({}))

  it('uploadImage POSTe un multipart avec le champ file', async () => {
    const f = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', { type: 'image/jpeg' })
    await videoModalService.uploadImage('m1', f)
    const [url, opts] = apiMock.mock.calls[0]!
    expect(url).toBe('/admin/video-modals/m1/image')
    expect(opts.method).toBe('POST')
    expect(opts.body).toBeInstanceOf(FormData)
    expect((opts.body as FormData).get('file')).toBeInstanceOf(File)
    expect(((opts.body as FormData).get('file') as File).name).toBe('a.jpg')
    // Pas de Content-Type posé à la main : le navigateur ajoute la frontière du multipart.
    expect(opts.headers).toBeUndefined()
  })

  it('removeImage DELETE', async () => {
    await videoModalService.removeImage('m1')
    expect(apiMock).toHaveBeenCalledWith('/admin/video-modals/m1/image', { method: 'DELETE' })
  })
})
