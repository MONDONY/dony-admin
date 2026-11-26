import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, type AdminUser } from '@/stores/auth'
import { clearLockContext, readLockContext, rememberLockContext } from '@/features/mobile/lib/lockState'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('import.meta', { server: false })

const adminUser: AdminUser = {
  id: 'u', email: 'admin@yadony.com', role: 'ADMIN', status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: {},
}
type Mw = (_to: { path: string, fullPath?: string }) => unknown

describe('auth.global middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    navigateToMock.mockClear()
    sessionStorage.clear()
    clearLockContext()
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

  it('allows /m/verrouille without auth', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/m/verrouille' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('sends unauthenticated /m pages to the lock page, never to /login', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/m/alertes' })
    expect(navigateToMock).toHaveBeenCalledWith('/m/verrouille')
    expect(navigateToMock).not.toHaveBeenCalledWith('/login')
  })

  it('unauthenticated /m/alertes/<id> goes to /m/verrouille and remembers the full path', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/m/alertes/0b2f-77', fullPath: '/m/alertes/0b2f-77?tab=detail' })
    expect(navigateToMock).toHaveBeenCalledWith('/m/verrouille')
    expect(readLockContext().path).toBe('/m/alertes/0b2f-77?tab=detail')
  })

  it('keeps the remembered email when it remembers a new return path', async () => {
    rememberLockContext({ path: '/m/support', email: 'admin@yadony.com' })
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/m/alertes', fullPath: '/m/alertes' })
    expect(readLockContext()).toEqual({ path: '/m/alertes', email: 'admin@yadony.com' })
  })

  it('does not remember an unsafe /m return path', async () => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path: '/m/x', fullPath: '/m/..//evil.test' })
    expect(navigateToMock).toHaveBeenCalledWith('/m/verrouille')
    expect(readLockContext().path).toBeNull()
  })

  it.each(['/users', '/', '/mfa-setup', '/alertes'])('desktop unauthenticated %s still goes to /login', async (path) => {
    const mw = (await import('@/middleware/auth.global')).default as Mw
    await mw({ path, fullPath: path })
    expect(navigateToMock).toHaveBeenCalledWith('/login')
    expect(readLockContext().path).toBeNull()
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
