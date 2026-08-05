import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, type AdminUser } from '@/stores/auth'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('import.meta', { server: false })

const adminUser: AdminUser = {
  id: 'u', email: 'admin@yadony.com', role: 'ADMIN', status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: {},
}
type Mw = (_to: { path: string }) => unknown

describe('auth.global middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    navigateToMock.mockClear()
  })

  it('redirects unauthenticated to /login', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/users' })
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('allows /login without auth', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/login' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('allows /denied without auth', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/denied' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('lets authenticated users through', async () => {
    useAuthStore().setSession('t', adminUser)
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/users' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated /change-password access to /login', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/change-password' })
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('lets authenticated users reach /change-password', async () => {
    useAuthStore().setSession('t', adminUser)
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/change-password' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('redirects required-password sessions to change-password', async () => {
    useAuthStore().setSession('token', { ...adminUser, mustChangePassword: true })
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/users' })
    expect(navigateToMock).toHaveBeenCalledWith('/change-password')
  })

  it('does not redirect a required-password session already on /change-password', async () => {
    useAuthStore().setSession('token', { ...adminUser, mustChangePassword: true })
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/change-password' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
