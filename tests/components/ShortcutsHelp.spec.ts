import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ShortcutsHelp from '@/components/layout/ShortcutsHelp.vue'
import { useShortcutsHelp } from '@/composables/useShortcuts'
import { useAuthStore } from '@/stores/auth'
import { makeAdmin } from '../helpers/auth'

let w: VueWrapper | null = null
beforeEach(() => { setActivePinia(createPinia()); useShortcutsHelp().hide() })
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })

describe('ShortcutsHelp', () => {
  it('fermée par défaut', () => {
    useAuthStore().setSession('t', makeAdmin('SUPER_ADMIN'))
    w = mount(ShortcutsHelp, { attachTo: document.body })
    expect(document.querySelector('[data-test="shortcuts-overlay"]')).toBeNull()
  })

  it('liste les pages autorisées au rôle, avec leur lettre', async () => {
    useAuthStore().setSession('t', makeAdmin('SUPPORT'))
    w = mount(ShortcutsHelp, { attachTo: document.body })
    useShortcutsHelp().show()
    await w.vm.$nextTick()
    const list = document.querySelector('[data-test="shortcuts-pages"]')!
    expect(list.textContent).toContain('Utilisateurs')
    expect(list.textContent).toContain('Support')
    expect(list.textContent).not.toContain('Audit')
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true')
  })

  it('se ferme par le bouton et par un clic sur le fond', async () => {
    useAuthStore().setSession('t', makeAdmin('ADMIN'))
    w = mount(ShortcutsHelp, { attachTo: document.body })
    useShortcutsHelp().show()
    await w.vm.$nextTick()
    ;(document.querySelector('[data-test="shortcuts-close"]') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(document.querySelector('[data-test="shortcuts-overlay"]')).toBeNull()

    useShortcutsHelp().show()
    await w.vm.$nextTick()
    document.querySelector('[data-test="shortcuts-overlay"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(document.querySelector('[data-test="shortcuts-overlay"]')).toBeNull()
  })
})
