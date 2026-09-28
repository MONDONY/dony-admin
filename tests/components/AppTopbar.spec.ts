import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AppTopbar from '@/components/layout/AppTopbar.vue'
import { useNotificationsStore } from '@/stores/notifications'

const signOutMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signOut: signOutMock }),
}))
vi.mock('@/components/ui/ThemeToggle.vue', () => ({ default: { name: 'ThemeToggle', template: '<div />' } }))
vi.mock('@/features/notifications/components/NotificationBell.vue', () => ({
  default: { name: 'NotificationBell', template: '<button data-test="notif-bell-stub" />' },
}))
type HeadInput = { value: { titleTemplate: (_t?: string) => string } }
const useHeadMock = vi.fn()
vi.stubGlobal('useHead', useHeadMock)

describe('AppTopbar', () => {
  beforeEach(() => {
    signOutMock.mockClear()
    useHeadMock.mockClear()
    setActivePinia(createPinia())
  })

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
  it('affiche la cloche de notifications', () => {
    const wrapper = mount(AppTopbar, { props: { title: 'X' } })
    expect(wrapper.find('[data-test="notif-bell-stub"]').exists()).toBe(true)
  })

  it('préfixe le titre de l’onglet avec « (N) » quand il y a des non lus', async () => {
    mount(AppTopbar, { props: { title: 'X' } })
    const input = useHeadMock.mock.calls[0]![0] as HeadInput
    expect(input.value.titleTemplate('Yadony ADMIN')).toBe('Yadony ADMIN')
    expect(input.value.titleTemplate(undefined)).toBe('Yadony ADMIN')
    const s = useNotificationsStore()
    const before = input.value
    s.unreadCount = 7
    await flushPromises()
    // Le computed doit dépendre des compteurs, sinon unhead ne recalcule jamais le titre.
    expect(input.value).not.toBe(before)
    expect(input.value.titleTemplate('Yadony ADMIN')).toBe('(7) Yadony ADMIN')
    s.unreadCapped = true
    expect(input.value.titleTemplate('Yadony ADMIN')).toBe('(99+) Yadony ADMIN')
  })

  it('pas de préfixe quand les notifications sont indisponibles (ancien back)', () => {
    mount(AppTopbar, { props: { title: 'X' } })
    const input = useHeadMock.mock.calls[0]![0] as HeadInput
    const s = useNotificationsStore()
    s.unreadCount = 7
    s.unavailable = true
    expect(input.value.titleTemplate('Yadony ADMIN')).toBe('Yadony ADMIN')
  })
})
