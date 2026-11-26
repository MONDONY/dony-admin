import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const state = ref<string>('off')
const error = ref<string | null>(null)
const enable = vi.fn()
const disable = vi.fn()
const refresh = vi.fn()
vi.mock('@/features/mobile/composables/usePushSubscription', () => ({
  usePushSubscription: () => ({ state, error, enable, disable, refresh }),
}))

import PushToggle from '@/features/mobile/components/PushToggle.vue'

describe('PushToggle', () => {
  beforeEach(() => {
    state.value = 'off'
    error.value = null
    enable.mockReset().mockResolvedValue(undefined)
    disable.mockReset().mockResolvedValue(undefined)
    refresh.mockReset()
  })

  it('refreshes on mount', () => {
    mount(PushToggle)
    expect(refresh).toHaveBeenCalled()
  })

  it('off: button "Activer les notifications" calls enable', async () => {
    state.value = 'off'
    const w = mount(PushToggle)
    const b = w.find('button')
    expect(b.text()).toBe('Activer les notifications')
    await b.trigger('click')
    expect(enable).toHaveBeenCalled()
  })

  it('on: button "Désactiver les notifications" calls disable', async () => {
    state.value = 'on'
    const w = mount(PushToggle)
    const b = w.find('button')
    expect(b.text()).toBe('Désactiver les notifications')
    await b.trigger('click')
    expect(disable).toHaveBeenCalled()
  })

  it('needs-install: iOS hint, no button', () => {
    state.value = 'needs-install'
    const w = mount(PushToggle)
    expect(w.text()).toContain("Ajoutez l'app à l'écran d'accueil pour recevoir les notifications")
    expect(w.find('button').exists()).toBe(false)
  })

  it('denied: explanatory text, no button', () => {
    state.value = 'denied'
    const w = mount(PushToggle)
    expect(w.text()).toContain('Notifications refusées dans les réglages de ce téléphone')
    expect(w.find('button').exists()).toBe(false)
  })

  it('unsupported: renders nothing', () => {
    state.value = 'unsupported'
    const w = mount(PushToggle)
    expect(w.text()).toBe('')
    expect(w.find('button').exists()).toBe(false)
  })

  // ── Échecs visibles et double toucher (F7) ────────────────────────────────

  it('announces changes politely (aria-live on the wrapper)', () => {
    const w = mount(PushToggle)
    expect(w.find('[data-test="push-toggle"]').attributes('aria-live')).toBe('polite')
  })

  it.each([
    ['generic', 'Activation impossible. Réessayez ou contactez l’administrateur.'],
    ['config', 'Notifications non configurées sur ce serveur. Contactez l’administrateur.'],
    ['permission', 'Notifications bloquées pour ce site. Autorisez-les dans les réglages du téléphone, puis réessayez.'],
  ])('shows the %s error line under the button', async (kind, text) => {
    enable.mockImplementation(async () => { error.value = kind })
    const w = mount(PushToggle)
    expect(w.find('[data-test="push-error"]').exists()).toBe(false)
    await w.find('button').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="push-error"]').text()).toBe(text)
  })

  it('disables the button while enable() runs: a double tap enables once', async () => {
    let release: () => void = () => {}
    enable.mockImplementation(() => new Promise<void>((r) => { release = r }))
    const w = mount(PushToggle)
    const b = w.find('button')
    await b.trigger('click')
    expect(b.attributes('disabled')).toBeDefined()
    await b.trigger('click')
    expect(enable).toHaveBeenCalledTimes(1)
    release()
    await flushPromises()
    expect(w.find('button').attributes('disabled')).toBeUndefined()
  })

  it('disables the button while disable() runs', async () => {
    state.value = 'on'
    let release: () => void = () => {}
    disable.mockImplementation(() => new Promise<void>((r) => { release = r }))
    const w = mount(PushToggle)
    await w.find('button').trigger('click')
    await w.find('button').trigger('click')
    expect(disable).toHaveBeenCalledTimes(1)
    expect(w.find('button').attributes('disabled')).toBeDefined()
    release()
    await flushPromises()
    expect(w.find('button').attributes('disabled')).toBeUndefined()
  })
})
