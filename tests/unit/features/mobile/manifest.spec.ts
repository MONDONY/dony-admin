import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface Icon { src: string, sizes: string, type: string, purpose?: string }
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/m/manifest.webmanifest'), 'utf8')) as { scope: string, start_url: string, icons: Icon[] }

/** Largeur et hauteur lues dans l'en-tête IHDR du PNG. */
function pngSize(src: string): [number, number] {
  const buf = readFileSync(resolve(process.cwd(), 'public', src.replace(/^\/siragbe\//, '')))
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)]
}

describe('mobile manifest', () => {
  it('every icon exists with the declared size', () => {
    for (const icon of manifest.icons) {
      const [w, h] = pngSize(icon.src)
      expect(`${w}x${h}`).toBe(icon.sizes)
    }
  })

  it('offers a padded maskable icon (Android adaptive icons) besides the regular ones', () => {
    const maskable = manifest.icons.filter(i => i.purpose === 'maskable')
    expect(maskable).toEqual([{ src: '/siragbe/m/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }])
    expect(manifest.icons.filter(i => !i.purpose).map(i => i.sizes)).toEqual(['192x192', '512x512'])
  })

  it('stays scoped to the mobile section', () => {
    expect(manifest.scope).toBe('/siragbe/m/')
    expect(manifest.start_url).toBe('/siragbe/m/')
  })
})
