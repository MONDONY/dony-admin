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
})
