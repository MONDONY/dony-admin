import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore, type AdminUser, type AdminPermission } from '@/stores/auth'

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)

const makeAdmin = (
  role: AdminUser['role'],
  overrides: Record<string, boolean> = {},
): AdminUser => ({
  id: 'u', email: 'admin@yadony.com', role, status: 'ACTIVE',
  mustChangePassword: false, permissionOverrides: overrides,
})
type Mw = (_to: { path: string; meta: { permission?: AdminPermission; permissionAnyOf?: readonly AdminPermission[] } }) => unknown
const route = (permission?: AdminPermission) => ({ path: '/x', meta: { permission } })
const anyOf = (permissionAnyOf: readonly AdminPermission[], permission?: AdminPermission) => ({ path: '/x', meta: { permission, permissionAnyOf } })

describe('admin-only middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    navigateToMock.mockClear()
  })

  it('redirects unauthenticated to /denied', async () => {
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route())
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })

  it('allows ADMIN through', async () => {
    useAuthStore().setSession('t', makeAdmin('ADMIN'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route())
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('allows SUPER_ADMIN through', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPER_ADMIN'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route())
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('allows SUPPORT through', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPPORT'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route())
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  // --- Contrôle fin par permission (meta.permission) ---

  it('allows SUPPORT on a page it has permission for (ALERT_VIEW)', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPPORT'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route('ALERT_VIEW'))
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('denies SUPPORT on a page it lacks permission for (AUDIT_VIEW)', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPPORT'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route('AUDIT_VIEW'))
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })

  it('denies ADMIN on ADMIN_MANAGE (administrateurs page)', async () => {
    useAuthStore().setSession('t', makeAdmin('ADMIN'))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route('ADMIN_MANAGE'))
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })

  it('allows ADMIN on ADMIN_MANAGE when an override grants it', async () => {
    useAuthStore().setSession('t', makeAdmin('ADMIN', { ADMIN_MANAGE: true }))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route('ADMIN_MANAGE'))
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('denies SUPPORT when an override revokes a base permission', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPPORT', { ALERT_VIEW: false }))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route('ALERT_VIEW'))
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })

  it('allows SUPER_ADMIN everywhere, overrides ignored', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPER_ADMIN', { ADMIN_MANAGE: false }))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(route('ADMIN_MANAGE'))
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  // --- Une permission parmi plusieurs (meta.permissionAnyOf) ---

  it('permissionAnyOf: lets through an admin holding any one of the listed permissions', async () => {
    useAuthStore().setSession('t', makeAdmin('ADMIN', { ALERT_VIEW: false }))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(anyOf(['ALERT_VIEW', 'DISPUTE_VIEW']))
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('permissionAnyOf: denies an admin holding none of them', async () => {
    useAuthStore().setSession('t', makeAdmin('ADMIN', { ALERT_VIEW: false, DISPUTE_VIEW: false }))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(anyOf(['ALERT_VIEW', 'DISPUTE_VIEW']))
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })

  it('permissionAnyOf and permission together: both must hold; an empty list denies', async () => {
    useAuthStore().setSession('t', makeAdmin('ADMIN', { ALERT_VIEW: false }))
    const mw = (await import('@/middleware/admin-only')).default as Mw
    mw(anyOf(['DISPUTE_VIEW'], 'ALERT_VIEW'))
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
    navigateToMock.mockClear()
    mw(anyOf([]))
    expect(navigateToMock).toHaveBeenCalledWith('/denied')
  })
})
