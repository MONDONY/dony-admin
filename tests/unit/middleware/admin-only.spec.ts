import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, type AuthUser } from '@/stores/auth'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)

const user = (roles: string[]): AuthUser => ({
  id: 'u', phoneNumber: '+33', displayName: 'A',
  isProAccount: false, roles, avatarUrl: null,
})
type Mw = () => unknown

describe('admin-only middleware', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    navigateToMock.mockClear()
  })

  it('redirects non-admin to /denied', async () => {
    useAuthStore().setSession('t', user(['SENDER']))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw()
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })

  it('allows admin through', async () => {
    useAuthStore().setSession('t', user(['ADMIN']))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw()
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
