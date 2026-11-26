import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

// Console de bureau : le layout par défaut ferme la session après la durée d'inactivité
// configurée, avec un bandeau 60 s avant (« Rester connecté »).

vi.mock('@/components/layout/AppSidebar.vue', () => ({ default: { name: 'AppSidebar', template: '<nav />' } }))
vi.mock('@/components/layout/ShortcutsHelp.vue', () => ({ default: { name: 'ShortcutsHelp', template: '<div />' } }))
vi.mock('@/features/help-center/components/HelpAssistant.vue', () => ({ default: { name: 'HelpAssistant', template: '<div />' } }))
vi.mock('@/components/layout/AppTopbar.vue', () => ({
  default: { name: 'AppTopbar', props: ['title', 'subtitle', 'crumbs', 'backTo'], template: '<header />' },
}))
const signOutMock = vi.fn()
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({
  useFirebaseAuth: () => ({ signOut: signOutMock }),
}))

const navigateMock = vi.fn()
vi.stubGlobal('navigateTo', navigateMock)
vi.stubGlobal('useRouter', () => ({ push: vi.fn(), back: vi.fn() }))
const routeState = { path: '/transactions', fullPath: '/transactions?x=1', meta: { pageTitle: 'Transactions' }, query: {} }
vi.stubGlobal('useRoute', () => routeState)
const runtimePublic: Record<string, unknown> = {}
vi.stubGlobal('useRuntimeConfig', () => ({ public: runtimePublic }))

import { seedAuth } from '../helpers/auth'
import { ACTIVITY_KEY, _resetLockStateMemory } from '@/features/mobile/lib/lockState'

const MIN = 60 * 1000
const ClientOnly = { template: '<div><slot /></div>' }
const wrappers: VueWrapper[] = []

async function mountLayout() {
  const Layout = (await import('@/layouts/default.vue')).default
  const w = mount(Layout, { global: { stubs: { ClientOnly } }, slots: { default: '<p class="page">Contenu</p>' } })
  wrappers.push(w)
  return w
}
const warning = (w: VueWrapper) => w.find('[data-test="idle-warning"]')

describe('desktop layout: inactivity expiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T10:00:00Z'))
    signOutMock.mockReset().mockResolvedValue(undefined)
    navigateMock.mockReset()
    for (const k of Object.keys(runtimePublic)) delete runtimePublic[k]
    localStorage.clear()
    _resetLockStateMemory()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    seedAuth('ADMIN')
  })
  afterEach(() => {
    wrappers.splice(0).forEach(w => w.unmount())
    vi.useRealTimers()
  })

  it('shows the warning 60 seconds before the expiry, with a one-line "Rester connecté" button', async () => {
    const w = await mountLayout()
    expect(Number(localStorage.getItem(ACTIVITY_KEY))).toBe(Date.now())
    await vi.advanceTimersByTimeAsync(29 * MIN - 1000)
    expect(warning(w).exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(warning(w).exists()).toBe(true)
    expect(warning(w).text()).toContain('Votre session va se fermer pour inactivité')
    const stay = w.get('[data-test="idle-stay"]')
    expect(stay.text()).toBe('Rester connecté')
    expect(stay.classes()).toContain('whitespace-nowrap')
    expect(w.text()).not.toContain('—')
    // Bandeau non modal : la page reste là, en dessous.
    expect(w.find('.page').exists()).toBe(true)
    // Zone annoncée aux lecteurs d'écran, présente avant le bandeau.
    const region = w.get('[data-test="idle-warning-region"]')
    expect(region.attributes('role')).toBe('status')
    expect(region.attributes('aria-live')).toBe('polite')
  })

  it('"Rester connecté" hides the warning and restarts the delay', async () => {
    const w = await mountLayout()
    await vi.advanceTimersByTimeAsync(29 * MIN + 20 * 1000)
    await w.get('[data-test="idle-stay"]').trigger('click')
    expect(warning(w).exists()).toBe(false)
    expect(Number(localStorage.getItem(ACTIVITY_KEY))).toBe(Date.now())
    await vi.advanceTimersByTimeAsync(2 * MIN)
    expect(signOutMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(27 * MIN)
    expect(warning(w).exists()).toBe(true)
  })

  it('without a reaction, closes the session and goes to /login with the page as return path', async () => {
    await mountLayout()
    await vi.advanceTimersByTimeAsync(30 * MIN)
    const target = '/login?redirect=%2Ftransactions%3Fx%3D1'
    expect(signOutMock).toHaveBeenCalledWith({ revokePush: false, redirectTo: target })
    expect(navigateMock).toHaveBeenCalledWith(target)
  })

  it('shortest configured duration (5 minutes): warning at 4 minutes, closing at 5', async () => {
    runtimePublic.idleLockMinutes = 5
    const w = await mountLayout()
    await vi.advanceTimersByTimeAsync(4 * MIN - 1000)
    expect(warning(w).exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(warning(w).exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(MIN)
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('not signed in (layout rendered before the redirect to /login): inert', async () => {
    setActivePinia(createPinia())
    const w = await mountLayout()
    await vi.advanceTimersByTimeAsync(40 * MIN)
    expect(warning(w).exists()).toBe(false)
    expect(localStorage.getItem(ACTIVITY_KEY)).toBeNull()
    expect(signOutMock).not.toHaveBeenCalled()
  })
})
