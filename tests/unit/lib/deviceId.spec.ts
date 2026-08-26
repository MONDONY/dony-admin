import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getDeviceId', () => {
  const STORAGE_KEY = 'yadony_device_id'

  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('génère et persiste un UUID quand localStorage est vide', async () => {
    const { getDeviceId } = await import('@/lib/deviceId')
    const id = getDeviceId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(id)
  })

  it('retourne le même UUID à chaque appel si déjà stocké', async () => {
    localStorage.setItem(STORAGE_KEY, 'fixed-uuid-1234')
    const { getDeviceId } = await import('@/lib/deviceId')
    expect(getDeviceId()).toBe('fixed-uuid-1234')
  })

  it('retourne une chaîne vide si window est undefined (SSR)', async () => {
    const originalWindow = globalThis.window
    // @ts-expect-error simule l'environnement SSR
    delete globalThis.window
    const { getDeviceId } = await import('@/lib/deviceId')
    const id = getDeviceId()
    expect(id).toBe('')
    globalThis.window = originalWindow
  })
})
