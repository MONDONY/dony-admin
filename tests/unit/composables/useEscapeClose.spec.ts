import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useEscapeClose } from '@/composables/useEscapeClose'

function host(onClose: () => void, active?: () => boolean) {
  return mount(defineComponent({ setup() { useEscapeClose(onClose, active); return () => h('div') } }))
}
const esc = (target: EventTarget = window) => {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e
}

describe('useEscapeClose', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('ferme sur Échap', () => {
    const onClose = vi.fn()
    host(onClose)
    esc()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignore les autres touches et un panneau inactif', () => {
    const onClose = vi.fn()
    host(onClose, () => false)
    esc()
    expect(onClose).not.toHaveBeenCalled()
    const w = host(onClose)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(onClose).not.toHaveBeenCalled()
    w.unmount()
  })

  it('laisse Échap au champ de saisie qui a le focus', () => {
    const onClose = vi.fn()
    host(onClose)
    const input = document.createElement('input')
    document.body.appendChild(input)
    esc(input)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('laisse Échap à la fenêtre modale ouverte par-dessus', () => {
    const onClose = vi.fn()
    host(onClose)
    const dlg = document.createElement('div')
    dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true')
    document.body.appendChild(dlg)
    esc()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('se désabonne au démontage', () => {
    const onClose = vi.fn()
    host(onClose).unmount()
    esc()
    expect(onClose).not.toHaveBeenCalled()
  })
})
