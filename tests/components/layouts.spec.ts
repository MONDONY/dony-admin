import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const LoginLeftPanelStub = { name: 'LoginLeftPanel', template: '<div class="login-left" />' }

describe('auth layout', () => {
  it('renders slot content', async () => {
    const AuthLayout = (await import('@/layouts/auth.vue')).default
    const wrapper = mount(AuthLayout, {
      slots: { default: '<span class="slot-content">Login</span>' },
      global: { stubs: { LoginLeftPanel: LoginLeftPanelStub } },
    })
    expect(wrapper.find('.slot-content').exists()).toBe(true)
  })
})

describe('default layout', () => {
  it('renders with sidebar and topbar', async () => {
    vi.stubGlobal('useRoute', () => ({
      meta: { pageTitle: 'Utilisateurs', pageSubtitle: 'Gestion' },
    }))
    const DefaultLayout = (await import('@/layouts/default.vue')).default
    const wrapper = mount(DefaultLayout, {
      slots: { default: '<div class="page-content">Page</div>' },
      global: {
        stubs: {
          AppSidebar: { name: 'AppSidebar', template: '<nav class="sidebar" />' },
          AppTopbar: { name: 'AppTopbar', template: '<header class="topbar" />', props: ['title', 'subtitle'] },
        },
      },
    })
    expect(wrapper.find('.sidebar').exists()).toBe(true)
    expect(wrapper.find('.topbar').exists()).toBe(true)
    expect(wrapper.find('.page-content').exists()).toBe(true)
    vi.unstubAllGlobals()
  })
})
