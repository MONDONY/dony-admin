import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect } from 'vitest'
import { useAuthStore, type AdminUser } from '@/stores/auth'

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
    expect(localStorage.getItem('dony-admin-session')).toBeNull()
  })

  it('does not expose a rehydrate action', () => {
    const store = useAuthStore() as unknown as Record<string, unknown>
    expect(store.rehydrate).toBeUndefined()
  })
})
