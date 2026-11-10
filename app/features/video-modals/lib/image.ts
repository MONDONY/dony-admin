import { IMAGE_MAX_BYTES, IMAGE_MAX_SIDE, IMAGE_MIME_TYPES } from '@/features/video-modals/types/index'

/** Message pour l'admin, ou null si le fichier convient. */
export type ImageCheck = string | null

const FORMATS_TEXT = 'JPEG, PNG ou WebP, 3 Mo au plus, 2400 px au plus de côté'
export const IMAGE_RULES_HINT = FORMATS_TEXT

const mo = (bytes: number) => (bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/** Type réel d'après les premiers octets (le type annoncé par le navigateur ne suffit pas). */
export function sniffImageType(head: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (head.length >= 8 && png.every((b, i) => head[i] === b)) return 'image/png'
  const ascii = (from: number, text: string) => text.split('').every((c, i) => head[from + i] === c.charCodeAt(0))
  if (head.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp'
  return null
}

async function readHead(file: File): Promise<Uint8Array> {
  const buf = await file.slice(0, 16).arrayBuffer()
  return new Uint8Array(buf)
}

/** Dimensions lues par le navigateur ; null si elles ne peuvent pas être lues (le back vérifie aussi). */
export async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bmp = await createImageBitmap(file)
    const size = { width: bmp.width, height: bmp.height }
    bmp.close?.()
    return size
  } catch {
    return null
  }
}

/**
 * Mêmes refus que le back, avant tout envoi : fichier vide, plus de 3 Mo, contenu qui n'est ni
 * JPEG, ni PNG, ni WebP (même si l'extension le prétend), plus de 2400 px de côté.
 */
export async function validateImageFile(file: File): Promise<ImageCheck> {
  if (file.size === 0) return 'Ce fichier est vide.'
  if (file.size > IMAGE_MAX_BYTES) {
    return `Image trop lourde (${mo(file.size)} Mo) : 3 Mo au plus. Réduisez-la ou exportez-la en WebP.`
  }
  const announced = (IMAGE_MIME_TYPES as readonly string[]).includes(file.type)
  const real = sniffImageType(await readHead(file))
  if (!real || (file.type && !announced)) {
    return `Format non accepté : ${FORMATS_TEXT}. Les GIF, HEIC et PDF sont refusés.`
  }
  const size = await readImageSize(file)
  if (size && (size.width > IMAGE_MAX_SIDE || size.height > IMAGE_MAX_SIDE)) {
    return `Image trop grande (${size.width} × ${size.height} px) : ${IMAGE_MAX_SIDE} px au plus de côté.`
  }
  return null
}
