import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect } from 'vitest'
import { useAuthStore, effectivePermissions, ALL_PERMISSIONS, type AdminUser } from '@/stores/auth'
import { seedAuth } from '~/tests/helpers/auth'

const adminUser: AdminUser = {
  id: 'user-1',
  email: 'admin@yadony.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  mustChangePassword: false,
  permissionOverrides: {},
}

describe('useAuthStore (admin)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts unauthenticated, not admin', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.isAdmin).toBe(false)
  })

  it('setSession with ADMIN role makes isAdmin true', () => {
    const store = useAuthStore()
    store.setSession('tok', adminUser)
    expect(store.isAuthenticated).toBe(true)
    expect(store.isAdmin).toBe(true)
  })

  it('setSession with SUPER_ADMIN makes isAdmin true', () => {
    const store = useAuthStore()
    store.setSession('tok', { ...adminUser, role: 'SUPER_ADMIN' })
    expect(store.isAdmin).toBe(true)
  })

  it('setSession with SUPPORT makes isAdmin true', () => {
    const store = useAuthStore()
    store.setSession('tok', { ...adminUser, role: 'SUPPORT' })
    expect(store.isAdmin).toBe(true)
    expect(store.isSupport).toBe(true)
  })

  it('clear() resets and drops admin', () => {
    const store = useAuthStore()
    store.setSession('tok', adminUser)
    store.clear()
    expect(store.isAuthenticated).toBe(false)
    expect(store.isAdmin).toBe(false)
  })

  it('does not persist the token in localStorage', () => {
    useAuthStore().setSession('token', adminUser)
    expect(localStorage.getItem('yadony-admin-session')).toBeNull()
  })

  it('does not expose a rehydrate action', () => {
    const store = useAuthStore() as unknown as Record<string, unknown>
    expect(store.rehydrate).toBeUndefined()
  })

  // --- Permissions effectives (miroir AdminPermissions.effective() backend) ---

  it('SUPER_ADMIN has all permissions and ignores overrides', () => {
    const store = useAuthStore()
    store.setSession('t', { ...adminUser, role: 'SUPER_ADMIN', permissionOverrides: { ADMIN_MANAGE: false } })
    expect(store.can('ADMIN_MANAGE')).toBe(true)
    expect(store.permissions.size).toBe(ALL_PERMISSIONS.length)
  })

  it('ADMIN has everything except ADMIN_MANAGE', () => {
    const store = useAuthStore()
    store.setSession('t', adminUser)
    expect(store.can('PAYMENT_REFUND')).toBe(true)
    expect(store.can('DISPUTE_RESOLVE')).toBe(true)
    expect(store.can('ADMIN_MANAGE')).toBe(false)
  })

  it('SUPPORT lacks destructive payment/dispute/promo/audit/export permissions', () => {
    const store = useAuthStore()
    store.setSession('t', { ...adminUser, role: 'SUPPORT' })
    expect(store.can('PAYMENT_VIEW')).toBe(true)
    expect(store.can('ALERT_RESOLVE')).toBe(true)
    expect(store.can('PAYMENT_RELEASE')).toBe(false)
    expect(store.can('PAYMENT_REFUND')).toBe(false)
    expect(store.can('DISPUTE_RESOLVE')).toBe(false)
    expect(store.can('PROMO_MANAGE')).toBe(false)
    expect(store.can('AUDIT_VIEW')).toBe(false)
    expect(store.can('EXPORT_RUN')).toBe(false)
    expect(store.can('ADMIN_MANAGE')).toBe(false)
  })

  it('overrides grant and revoke permissions for non-super roles', () => {
    const store = useAuthStore()
    store.setSession('t', { ...adminUser, role: 'SUPPORT', permissionOverrides: { PAYMENT_REFUND: true, USER_BAN: false } })
    expect(store.can('PAYMENT_REFUND')).toBe(true)
    expect(store.can('USER_BAN')).toBe(false)
  })

  it('can() is false for everything when logged out', () => {
    const store = useAuthStore()
    expect(store.can('METRICS_VIEW')).toBe(false)
    expect(store.permissions.size).toBe(0)
  })

  it('effectivePermissions ignores unknown permission names', () => {
    const set = effectivePermissions('SUPPORT', { NOT_A_PERMISSION: true, USER_VIEW: false })
    expect(set.has('USER_VIEW')).toBe(false)
    expect([...set].every((p) => (ALL_PERMISSIONS as readonly string[]).includes(p))).toBe(true)
  })

  it('ADMIN can remove content and mute messaging', () => {
    seedAuth('ADMIN')
    const auth = useAuthStore()
    expect(auth.can('CONTENT_REMOVE')).toBe(true)
    expect(auth.can('USER_MESSAGE_MUTE')).toBe(true)
  })

  it('SUPPORT can neither remove content nor mute messaging', () => {
    seedAuth('SUPPORT')
    const auth = useAuthStore()
    expect(auth.can('CONTENT_REMOVE')).toBe(false)
    expect(auth.can('USER_MESSAGE_MUTE')).toBe(false)
  })

  it('SUPPORT can receive CONTENT_REMOVE via an override', () => {
    seedAuth('SUPPORT', { CONTENT_REMOVE: true })
    expect(useAuthStore().can('CONTENT_REMOVE')).toBe(true)
  })

  it('exposes 26 permissions, mirroring the backend enum', () => {
    expect(ALL_PERMISSIONS).toHaveLength(26)
  })
})
