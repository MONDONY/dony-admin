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
