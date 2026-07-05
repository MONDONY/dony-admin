import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

// Mock heavy imports at module level to prevent slow import chains
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('@/components/ui/ThemeToggle.vue', () => ({
  default: { name: 'ThemeToggle', template: '<div />' },
}))
vi.mock('@/features/auth/components/LoginLeftPanel.vue', () => ({
  default: { name: 'LoginLeftPanel', template: '<div class="login-left" />' },
}))
vi.mock('@/components/layout/AppSidebar.vue', () => ({
  default: { name: 'AppSidebar', template: '<nav class="sidebar" />' },
}))
vi.mock('@/components/layout/AppTopbar.vue', () => ({
  default: { name: 'AppTopbar', template: '<header class="topbar" />', props: ['title', 'subtitle'] },
}))
vi.mock('@/components/layout/NavItem.vue', () => ({
  default: { name: 'NavItem', template: '<div><slot name="icon" /><slot /></div>' },
}))
vi.mock('@/composables/useApi', () => ({
  useApi: () => vi.fn().mockResolvedValue(null),
}))

vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { firebaseApiKey: '', apiBaseUrl: '' } }))
vi.stubGlobal('navigateTo', vi.fn())

describe('auth layout', () => {
  it('renders slot content', async () => {
    const AuthLayout = (await import('@/layouts/auth.vue')).default
    const wrapper = mount(AuthLayout, {
      slots: { default: '<span class="slot-content">Login</span>' },
    })
    expect(wrapper.find('.slot-content').exists()).toBe(true)
  }, 15000)
})

describe('default layout', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders with sidebar and topbar', async () => {
    vi.stubGlobal('useRoute', () => ({
      meta: { pageTitle: 'Utilisateurs', pageSubtitle: 'Gestion' },
    }))
    const DefaultLayout = (await import('@/layouts/default.vue')).default
    const wrapper = mount(DefaultLayout, {
      slots: { default: '<div class="page-content">Page</div>' },
    })
    expect(wrapper.find('.sidebar').exists()).toBe(true)
    expect(wrapper.find('.topbar').exists()).toBe(true)
    expect(wrapper.find('.page-content').exists()).toBe(true)
  }, 15000)
})
