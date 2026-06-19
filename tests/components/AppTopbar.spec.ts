import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AppTopbar from '@/components/layout/AppTopbar.vue'

const signOutMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signOut: signOutMock }),
}))
vi.mock('@/components/ui/ThemeToggle.vue', () => ({ default: { name: 'ThemeToggle', template: '<div />' } }))

describe('AppTopbar', () => {
  beforeEach(() => signOutMock.mockClear())

  it('renders the title and subtitle', () => {
    const wrapper = mount(AppTopbar, { props: { title: 'Utilisateurs', subtitle: 'Gestion' } })
    expect(wrapper.text()).toContain('Utilisateurs')
    expect(wrapper.text()).toContain('Gestion')
  })

  it('renders title without subtitle when subtitle is not provided', () => {
    const wrapper = mount(AppTopbar, { props: { title: 'Dashboard' } })
    expect(wrapper.text()).toContain('Dashboard')
    expect(wrapper.find('p').exists()).toBe(false)
  })

  it('calls signOut when the logout button is clicked', async () => {
    const wrapper = mount(AppTopbar, { props: { title: 'X' } })
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
    expect(signOutMock).toHaveBeenCalledOnce()
  })
})
