import { afterEach, describe, it, expect, vi } from 'vitest'
import { readImageSize, sniffImageType, validateImageFile } from '@/features/video-modals/lib/image'

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]

const file = (bytes: number[], name: string, type: string, pad = 0) =>
  new File([new Uint8Array([...bytes, ...new Array(pad).fill(0)])], name, { type })

afterEach(() => vi.unstubAllGlobals())

describe('sniffImageType', () => {
  it('reconnaît JPEG, PNG, WebP d’après les octets', () => {
    expect(sniffImageType(new Uint8Array(JPEG))).toBe('image/jpeg')
    expect(sniffImageType(new Uint8Array(PNG))).toBe('image/png')
    expect(sniffImageType(new Uint8Array(WEBP))).toBe('image/webp')
  })
  it('refuse le reste', () => {
    expect(sniffImageType(new Uint8Array(GIF))).toBeNull()
    expect(sniffImageType(new Uint8Array([1, 2]))).toBeNull()
    expect(sniffImageType(new Uint8Array(0))).toBeNull()
  })
})

describe('validateImageFile', () => {
  it('accepte JPEG, PNG et WebP', async () => {
    expect(await validateImageFile(file(JPEG, 'a.jpg', 'image/jpeg'))).toBeNull()
    expect(await validateImageFile(file(PNG, 'a.png', 'image/png'))).toBeNull()
    expect(await validateImageFile(file(WEBP, 'a.webp', 'image/webp'))).toBeNull()
  })

  it('accepte pile 3 Mo, refuse au-delà avec le poids dans le message', async () => {
    expect(await validateImageFile(file(JPEG, 'a.jpg', 'image/jpeg', 3 * 1024 * 1024 - JPEG.length))).toBeNull()
    const msg = await validateImageFile(file(JPEG, 'a.jpg', 'image/jpeg', 3 * 1024 * 1024))
    expect(msg).toContain('trop lourde')
    expect(msg).toContain('3 Mo')
  })

  it('refuse un fichier vide', async () => {
    expect(await validateImageFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).toContain('vide')
  })

  it('refuse un GIF et un type annoncé inconnu', async () => {
    expect(await validateImageFile(file(GIF, 'a.gif', 'image/gif'))).toContain('Format non accepté')
    expect(await validateImageFile(file(JPEG, 'a.heic', 'image/heic'))).toContain('Format non accepté')
  })

  it('refuse un faux JPEG : le contenu réel compte, pas le type annoncé', async () => {
    expect(await validateImageFile(file([0x25, 0x50, 0x44, 0x46, 1, 2, 3], 'faux.jpg', 'image/jpeg'))).toContain('Format non accepté')
  })

  it('refuse plus de 2400 px de côté quand le navigateur sait les lire', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 2401, height: 800, close: vi.fn() }))
    expect(await validateImageFile(file(JPEG, 'a.jpg', 'image/jpeg'))).toContain('2400 px')
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 2400, height: 2400 }))
    expect(await validateImageFile(file(JPEG, 'a.jpg', 'image/jpeg'))).toBeNull()
  })

  it('dimensions illisibles ou API absente : on laisse le back trancher', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('x')))
    expect(await readImageSize(file(JPEG, 'a.jpg', 'image/jpeg'))).toBeNull()
    vi.stubGlobal('createImageBitmap', undefined)
    expect(await readImageSize(file(JPEG, 'a.jpg', 'image/jpeg'))).toBeNull()
  })
})
