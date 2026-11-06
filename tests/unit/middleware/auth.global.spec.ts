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

  // ── Double authentification (TOTP) ──────────────────────────────────────

  it('sends an admin without a second factor to /mfa-setup', async () => {
    useAuthStore().setSession('t', adminUser)
    useAuthStore().setMfaEnrolled(false)
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/users' })
    expect(navigateToMock).toHaveBeenCalledWith('/mfa-setup')
  })

  it('lets an admin without a second factor stay on /mfa-setup', async () => {
    useAuthStore().setSession('t', adminUser)
    useAuthStore().setMfaEnrolled(false)
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/mfa-setup' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('does not redirect while the enrollment state is unknown (seeded e2e session)', async () => {
    useAuthStore().setSession('t', adminUser)
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/users' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('does not redirect when TOTP is unavailable on this Firebase project', async () => {
    useAuthStore().setSession('t', adminUser)
    useAuthStore().setMfaEnrolled(false)
    useAuthStore().markMfaUnavailable()
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/users' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('asks for the password change before the second factor', async () => {
    useAuthStore().setSession('t', { ...adminUser, mustChangePassword: true })
    useAuthStore().setMfaEnrolled(false)
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/users' })
    expect(navigateToMock).toHaveBeenCalledWith('/change-password')
  })

  it('redirects unauthenticated /mfa-setup access to /login', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/mfa-setup' })
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('clear() forgets the enrollment state', () => {
    const auth = useAuthStore()
    auth.setSession('t', adminUser)
    auth.setMfaEnrolled(true)
    auth.markMfaUnavailable()
    auth.clear()
    expect(auth.mfaEnrolled).toBeNull()
    expect(auth.mfaUnavailable).toBe(false)
  })
})
