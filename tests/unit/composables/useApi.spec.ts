import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { AdminUser } from '@/stores/auth'

const fetchCreate = vi.fn((opts: unknown) => ({ __opts: opts }))
const navigateToMock = vi.fn()
const fbSignOutMock = vi.fn()

vi.stubGlobal('$fetch', { create: fetchCreate })
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: 'http://api.test/api/v1' } }))
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: {} }))

vi.mock('firebase/auth', () => ({
  signOut: (...a: unknown[]) => fbSignOutMock(...a),
}))

const adminUser: AdminUser = {
  id: 'u', email: 'admin@yadony.com', role: 'ADMIN', status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: {},
}

describe('useApi', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    fetchCreate.mockClear()
    navigateToMock.mockClear()
    fbSignOutMock.mockReset()
    const mod = await import('@/composables/useApi')
    mod._resetApiInstance()
  })

  it('creates a $fetch instance with the configured baseURL', async () => {
    const { useApi } = await import('@/composables/useApi')
    useApi()
    expect(fetchCreate).toHaveBeenCalledTimes(1)
    expect(fetchCreate.mock.calls[0][0].baseURL).toBe('http://api.test/api/v1')
  })

  it('onRequest adds Bearer token when authenticated', async () => {
    useAuthStore().setSession('the-token', adminUser)
    const { useApi } = await import('@/composables/useApi')
    useApi()
    const opts = fetchCreate.mock.calls[0][0]
    const req = { options: { headers: new Headers() } }
    await opts.onRequest(req)
    expect((req.options.headers as Headers).get('Authorization')).toBe('Bearer the-token')
  })

  it('caches the instance across calls', async () => {
    const { useApi } = await import('@/composables/useApi')
    useApi(); useApi()
    expect(fetchCreate).toHaveBeenCalledTimes(1)
  })

  it('clears the firebase session on 401', async () => {
    useAuthStore().setSession('the-token', adminUser)
    const { useApi } = await import('@/composables/useApi')
    useApi()
    const opts = fetchCreate.mock.calls[0][0]
    await opts.onResponseError({ response: { status: 401, _data: null } })

    expect(fbSignOutMock).toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('401 on a mobile page goes to the lock page with the page remembered, never to /login', async () => {
    window.history.replaceState(null, '', '/m/alertes/abc')
    try {
      useAuthStore().setSession('the-token', adminUser)
      const { useApi } = await import('@/composables/useApi')
      useApi()
      const opts = fetchCreate.mock.calls[0][0]
      await opts.onResponseError({ response: { status: 401, _data: null } })
      expect(navigateToMock).toHaveBeenCalledWith('/m/verrouille')
      expect(navigateToMock).not.toHaveBeenCalledWith('/login')
      const { readLockContext } = await import('@/features/mobile/lib/lockState')
      expect(readLockContext().path).toBe('/m/alertes/abc')
    } finally {
      window.history.replaceState(null, '', '/')
      sessionStorage.clear()
    }
  })

  // Le crochet d'erreur peut tourner pendant le rendu serveur (pas de `window`) : la page courante
  // n'y est pas lisible, la session se termine sur /login sans lever.
  it('401 during server rendering (no window): no crash, goes to /login', async () => {
    const realWindow = globalThis.window
    useAuthStore().setSession('the-token', adminUser)
    vi.stubGlobal('window', undefined)
    try {
      const { useApi } = await import('@/composables/useApi')
      useApi()
      const opts = fetchCreate.mock.calls[0][0]
      await expect(opts.onResponseError({ response: { status: 401, _data: null } })).resolves.toBeUndefined()
      expect(navigateToMock).toHaveBeenCalledWith('/login')
      expect(useAuthStore().isAuthenticated).toBe(false)
    } finally {
      vi.stubGlobal('window', realWindow)
    }
  })

  // Côté serveur, la page courante vient du routeur de Nuxt (useRoute), pas de `window`.
  it.each([
    ['/m/alertes/abc?x=1', '/m/verrouille', '/m/alertes/abc?x=1'],
    ['/users/abc', '/login', null],
  ])('401 during server rendering on %s: uses the route of the request (%s)', async (fullPath, target, remembered) => {
    const realWindow = globalThis.window
    useAuthStore().setSession('the-token', adminUser)
    vi.stubGlobal('useRoute', () => ({ fullPath }))
    vi.stubGlobal('window', undefined)
    const { readLockContext, clearLockContext } = await import('@/features/mobile/lib/lockState')
    try {
      sessionStorage.clear()
      clearLockContext()
      const { useApi } = await import('@/composables/useApi')
      useApi()
      const opts = fetchCreate.mock.calls[0][0]
      await opts.onResponseError({ response: { status: 401, _data: null } })
      expect(navigateToMock).toHaveBeenCalledWith(target)
      expect(readLockContext().path).toBe(remembered)
    } finally {
      clearLockContext()
      vi.stubGlobal('window', realWindow)
      vi.stubGlobal('useRoute', undefined)
      sessionStorage.clear()
    }
  })

  it('redirects to /change-password on 403 PASSWORD_CHANGE_REQUIRED and keeps the session', async () => {
    useAuthStore().setSession('the-token', adminUser)
    const { useApi } = await import('@/composables/useApi')
    useApi()
    const opts = fetchCreate.mock.calls[0][0]
    await opts.onResponseError({ response: { status: 403, _data: { code: 'PASSWORD_CHANGE_REQUIRED' } } })

    expect(navigateToMock).toHaveBeenCalledWith('/change-password')
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('keeps the session for other 403 errors', async () => {
    useAuthStore().setSession('the-token', adminUser)
    const { useApi } = await import('@/composables/useApi')
    useApi()
    const opts = fetchCreate.mock.calls[0][0]
    await opts.onResponseError({ response: { status: 403, _data: { code: 'FORBIDDEN' } } })

    expect(navigateToMock).not.toHaveBeenCalledWith('/change-password')
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('sends a not-yet-enrolled admin to /mfa-setup on 403 ADMIN_MFA_REQUIRED', async () => {
    useAuthStore().setSession('the-token', adminUser)
    useAuthStore().setMfaEnrolled(false)
    const { useApi } = await import('@/composables/useApi')
    useApi()
    const opts = fetchCreate.mock.calls[0][0]
    await opts.onResponseError({ response: { status: 403, _data: { code: 'ADMIN_MFA_REQUIRED' } } })

    expect(navigateToMock).toHaveBeenCalledWith('/mfa-setup')
    expect(useAuthStore().isAuthenticated).toBe(true)
  })

  it('signs an enrolled admin out on 403 ADMIN_MFA_REQUIRED (session opened without the code)', async () => {
    useAuthStore().setSession('the-token', adminUser)
    useAuthStore().setMfaEnrolled(true)
    fbSignOutMock.mockResolvedValue(undefined)
    const { useApi } = await import('@/composables/useApi')
    useApi()
    const opts = fetchCreate.mock.calls[0][0]
    await opts.onResponseError({ response: { status: 403, _data: { code: 'ADMIN_MFA_REQUIRED' } } })

    expect(fbSignOutMock).toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })
})
