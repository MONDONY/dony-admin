import { describe, it, expect, vi, afterEach } from 'vitest'
import { newIdempotencyKey } from '@/lib/idempotencyKey'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newIdempotencyKey', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rend un UUID v4, différent à chaque appel', () => {
    const a = newIdempotencyKey()
    expect(a).toMatch(UUID)
    expect(newIdempotencyKey()).not.toBe(a)
  })

  it('se replie sur getRandomValues quand randomUUID manque (contexte non sécurisé)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => real.getRandomValues(b) })
    expect(newIdempotencyKey()).toMatch(UUID)
  })
})
