import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, type AuthUser } from '@/stores/auth'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('import.meta', { server: false })

const admin = (): AuthUser => ({
  id: 'u', phoneNumber: '+33', displayName: 'A',
  isProAccount: false, roles: ['ADMIN'], avatarUrl: null,
})
type Mw = (to: { path: string }) => unknown

describe('auth.global middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    navigateToMock.mockClear()
  })

  it('redirects unauthenticated to /login', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    mw({ path: '/users' })
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('allows /login without auth', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    mw({ path: '/login' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('lets authenticated users through', async () => {
    useAuthStore().setSession('t', admin())
    const mw = (await import('@/middleware/auth.global')).default as Mw
    mw({ path: '/users' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
