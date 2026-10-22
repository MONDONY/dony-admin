import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog.vue'

const props = { open: true, title: 'Bannir', message: 'Sûr ?', confirmLabel: 'Bannir' }

describe('ConfirmActionDialog : clavier et accessibilité', () => {
  it('se déclare comme fenêtre modale', () => {
    const w = mount(ConfirmActionDialog, { props })
    const dlg = w.find('[role="dialog"]')
    expect(dlg.attributes('aria-modal')).toBe('true')
    expect(dlg.attributes('aria-label')).toBe('Bannir')
  })

  it('Échap annule', () => {
    const w = mount(ConfirmActionDialog, { props, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('cancel')).toHaveLength(1)
    w.unmount()
  })

  it('Échap ne fait rien quand la fenêtre est fermée, ni pour une autre touche', () => {
    const w = mount(ConfirmActionDialog, { props: { ...props, open: false }, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    const open = mount(ConfirmActionDialog, { props, attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(w.emitted('cancel')).toBeUndefined()
    expect(open.emitted('cancel')).toBeUndefined()
    w.unmount(); open.unmount()
  })

  it('se désabonne au démontage', () => {
    const w = mount(ConfirmActionDialog, { props, attachTo: document.body })
    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('cancel')).toBeUndefined()
  })
})
