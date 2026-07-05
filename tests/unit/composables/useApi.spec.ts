import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const fetchCreate = vi.fn((opts: unknown) => ({ __opts: opts }))
vi.stubGlobal('$fetch', { create: fetchCreate })
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: 'http://api.test/api/v1' } }))
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))

describe('useApi', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    fetchCreate.mockClear()
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
    useAuthStore().setSession('the-token', {
      id: 'u', phoneNumber: '+33', displayName: 'A',
      isProAccount: false, roles: ['ADMIN'], avatarUrl: null,
    })
    const { useApi } = await import('@/composables/useApi')
    useApi()
    const opts = fetchCreate.mock.calls[0][0]
    const req = { options: { headers: {} } }
    await opts.onRequest(req)
    expect(req.options.headers.Authorization).toBe('Bearer the-token')
  })

  it('caches the instance across calls', async () => {
    const { useApi } = await import('@/composables/useApi')
    useApi(); useApi()
    expect(fetchCreate).toHaveBeenCalledTimes(1)
  })
})
