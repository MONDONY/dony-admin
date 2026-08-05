import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, type AdminUser } from '@/stores/auth'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)

const makeAdmin = (role: AdminUser['role']): AdminUser => ({
  id: 'u', email: 'admin@yadony.com', role, status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: {},
})
type Mw = () => unknown

describe('admin-only middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    navigateToMock.mockClear()
  })

  it('redirects unauthenticated to /denied', async () => {
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw()
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })

  it('allows ADMIN through', async () => {
    useAuthStore().setSession('t', makeAdmin('ADMIN'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('allows SUPER_ADMIN through', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPER_ADMIN'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('allows SUPPORT through', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPPORT'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw()
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
