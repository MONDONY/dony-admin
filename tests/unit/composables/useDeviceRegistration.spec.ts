import { describe, it, expect, vi, beforeEach } from 'vitest'

// Top-level mock — vi.mock is hoisted to top of file
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

describe('useDeviceRegistration', () => {
  beforeEach(() => apiMock.mockReset())

  describe('buildWebDeviceName', () => {
    it('detects Chrome on Windows', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/112')).toBe('Chrome sur Windows')
    })

    it('detects Edge on Windows', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (Windows NT 10.0) Edg/112')).toBe('Edge sur Windows')
    })

    it('detects Firefox on Linux', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (X11; Linux x86_64) Firefox/115')).toBe('Firefox sur Linux')
    })

    it('detects Safari on macOS', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/537')).toBe('Safari sur macOS')
    })

    it('detects Chrome on Android', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (Linux; Android 12) Chrome/112')).toBe('Chrome sur Android')
    })

    it('detects Chrome on iOS', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 16) Chrome/112')).toBe('Chrome sur iOS')
    })

    it('detects Safari on an iPhone (its UA says "like Mac OS X"): iOS, not macOS', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari sur iOS')
    })

    it('detects Safari on an iPad (mobile UA): iOS', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari sur iOS')
    })

    it('keeps desktop results identical (real Mac Safari and Chrome)', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15')).toBe('Safari sur macOS')
      expect(buildWebDeviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe('Chrome sur macOS')
      expect(buildWebDeviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36')).toBe('Chrome sur Windows')
    })

    it('falls back to Navigateur/Web for unknown UA', async () => {
      const { buildWebDeviceName } = await import('@/composables/useDeviceRegistration')
      expect(buildWebDeviceName('Unknown/1.0')).toBe('Navigateur sur Web')
    })
  })

  describe('isCurrentDeviceRegistered', () => {
    it('returns true when isCurrent device is found', async () => {
      apiMock.mockResolvedValue([{ isCurrent: false }, { isCurrent: true }])
      const { isCurrentDeviceRegistered } = await import('@/composables/useDeviceRegistration')
      await expect(isCurrentDeviceRegistered()).resolves.toBe(true)
    })

    it('returns false when no device isCurrent', async () => {
      apiMock.mockResolvedValue([{ isCurrent: false }])
      const { isCurrentDeviceRegistered } = await import('@/composables/useDeviceRegistration')
      await expect(isCurrentDeviceRegistered()).resolves.toBe(false)
    })
  })

  describe('registerWebDevice', () => {
    it('posts device name and platform', async () => {
      apiMock.mockResolvedValue({})
      const { registerWebDevice } = await import('@/composables/useDeviceRegistration')
      await expect(registerWebDevice()).resolves.toBeUndefined()
      expect(apiMock).toHaveBeenCalledWith('/users/me/devices', expect.objectContaining({ method: 'POST' }))
    })
  })
})
