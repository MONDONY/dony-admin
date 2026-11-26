import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'

const state = ref<string>('off')
const enable = vi.fn()
const disable = vi.fn()
const refresh = vi.fn()
vi.mock('@/features/mobile/composables/usePushSubscription', () => ({
  usePushSubscription: () => ({ state, enable, disable, refresh }),
}))

import PushToggle from '@/features/mobile/components/PushToggle.vue'

describe('PushToggle', () => {
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
})
