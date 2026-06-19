import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadBlob } from '@/lib/downloadBlob'

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('creates an anchor, clicks it, and revokes the object URL', () => {
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor)

    const blob = new Blob(['a,b'], { type: 'text/csv' })
    downloadBlob(blob, 'export-users.csv')

    expect(createSpy).toHaveBeenCalledWith('a')
    expect(anchor.getAttribute('href')).toBe('blob:fake')
    expect(anchor.download).toBe('export-users.csv')
    expect(click).toHaveBeenCalledTimes(1)
    expect(anchor.isConnected).toBe(false) // removed after click
    expect((URL.revokeObjectURL as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('blob:fake')

    createSpy.mockRestore()
  })
})
