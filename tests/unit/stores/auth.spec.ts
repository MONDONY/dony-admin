import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, it, expect } from 'vitest'
import { useAuthStore, type AuthUser } from '@/stores/auth'

const adminUser: AuthUser = {
  id: 'user-1',
  phoneNumber: '+33612345678',
  displayName: 'Admin Dony',
  isProAccount: false,
  roles: ['ADMIN'],
  avatarUrl: null,
}

describe('useAuthStore (admin)', () => {
  beforeEach(() => setActivePinia(createPinia()))

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

  it('accepts ROLE_ADMIN prefix too', () => {
    const store = useAuthStore()
    store.setSession('tok', { ...adminUser, roles: ['ROLE_ADMIN'] })
    expect(store.isAdmin).toBe(true)
  })

  it('non-admin roles → isAdmin false', () => {
    const store = useAuthStore()
    store.setSession('tok', { ...adminUser, roles: ['SENDER', 'TRAVELER'] })
    expect(store.isAdmin).toBe(false)
  })

  it('clear() resets and drops admin', () => {
    const store = useAuthStore()
    store.setSession('tok', adminUser)
    store.clear()
    expect(store.isAuthenticated).toBe(false)
    expect(store.isAdmin).toBe(false)
  })
})
