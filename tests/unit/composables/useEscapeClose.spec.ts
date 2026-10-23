import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useEscapeClose } from '@/composables/useEscapeClose'

function host(onClose: () => void, active?: () => boolean) {
  return mount(defineComponent({ setup() { useEscapeClose(onClose, active); return () => h('div') } }))
}
/** Panneau qui est lui-même un dialogue modal (tiroir) : il passe sa racine. */
function modalHost(onClose: () => void) {
  return mount(defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null)
      useEscapeClose(onClose, () => true, () => root.value)
      return () => h('aside', { ref: root, role: 'dialog', 'aria-modal': 'true' }, [h('input', { 'data-test': 'field' })])
    },
  }), { attachTo: document.body })
}
const modal = (parent: Element = document.body) => {
  const dlg = document.createElement('div')
  dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true')
  parent.appendChild(dlg)
  return dlg
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

  describe('avec la racine du panneau (tiroir modal)', () => {
    it('ferme le tiroir alors qu’il est lui-même un dialogue modal', () => {
      const onClose = vi.fn()
      const w = modalHost(onClose)
      esc()
      expect(onClose).toHaveBeenCalledTimes(1)
      w.unmount()
    })

    it('ignore Échap quand une visionneuse ou une confirmation est ouverte par-dessus', () => {
      const onClose = vi.fn()
      const w = modalHost(onClose)
      // Visionneuse rendue dans le tiroir : plus bas dans le DOM, donc au-dessus.
      const viewer = modal(w.element)
      esc()
      expect(onClose).not.toHaveBeenCalled()
      viewer.remove()
      // Confirmation téléportée à la fin du body.
      const confirm = modal()
      esc()
      expect(onClose).not.toHaveBeenCalled()
      confirm.remove()
      esc()
      expect(onClose).toHaveBeenCalledTimes(1)
      w.unmount()
    })

    it('laisse Échap au champ de saisie du tiroir', () => {
      const onClose = vi.fn()
      const w = modalHost(onClose)
      esc(w.find('[data-test="field"]').element)
      expect(onClose).not.toHaveBeenCalled()
      w.unmount()
    })

    it('racine absente : un dialogue ouvert l’emporte', () => {
      const onClose = vi.fn()
      mount(defineComponent({ setup() { useEscapeClose(onClose, () => true, () => null); return () => h('div') } }))
      modal()
      esc()
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('se désabonne au démontage', () => {
    const onClose = vi.fn()
    host(onClose).unmount()
    esc()
    expect(onClose).not.toHaveBeenCalled()
  })
})
