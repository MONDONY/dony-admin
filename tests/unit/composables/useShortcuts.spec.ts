import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CHORD_TIMEOUT_MS, createShortcutHandler, useShortcutsHelp } from '@/composables/useShortcuts'
import { ALL_NAV_ENTRIES } from '@/components/layout/navConfig'

function key(k: string, opts: ConstructorParameters<typeof KeyboardEvent>[1] = {}, target?: HTMLElement) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts })
  if (target) Object.defineProperty(e, 'target', { value: target })
  return e
}

describe('raccourcis clavier', () => {
  const navigate = vi.fn()
  let clock = 0
  // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
  const make = (can: (p: never) => boolean = () => true) =>
    createShortcutHandler({ navigate, can: can as never, now: () => clock })

  beforeEach(() => { navigate.mockClear(); clock = 1000; useShortcutsHelp().hide() })

  it('« g » puis une lettre ouvre la page correspondante', () => {
    const on = make()
    on(key('g'))
    const e = key('u')
    on(e)
    expect(navigate).toHaveBeenCalledWith('/users')
    expect(e.defaultPrevented).toBe(true)
  })

  it('chaque raccourci de la config mène à sa page', () => {
    const on = make()
    for (const entry of ALL_NAV_ENTRIES.filter(n => n.shortcut)) {
      navigate.mockClear()
      on(key('g')); on(key(entry.shortcut!))
      expect(navigate).toHaveBeenCalledWith(entry.to)
    }
  })

  it('les lettres des raccourcis sont uniques', () => {
    const letters = ALL_NAV_ENTRIES.map(n => n.shortcut).filter(Boolean)
    expect(new Set(letters).size).toBe(letters.length)
    expect(letters).not.toContain('g')
  })

  it('l’enchaînement expire après le délai', () => {
    const on = make()
    on(key('g'))
    clock += CHORD_TIMEOUT_MS + 1
    on(key('u'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('refuse une page que le rôle ne peut pas voir', () => {
    const on = make(() => false)
    on(key('g')); on(key('u'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('ignore une lettre sans raccourci et consomme l’enchaînement', () => {
    const on = make()
    on(key('g')); on(key('z')); on(key('u'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('ne réagit pas dans un champ de saisie ni avec Ctrl/⌘/Alt', () => {
    const on = make()
    const input = document.createElement('input')
    on(key('g', {}, input)); on(key('u', {}, input))
    on(key('g', { metaKey: true })); on(key('u'))
    on(key('g', { ctrlKey: true })); on(key('u'))
    on(key('g', { altKey: true })); on(key('u'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('« ? » ouvre et ferme l’aide ; Échap la ferme', () => {
    const on = make()
    const help = useShortcutsHelp()
    on(key('?'))
    expect(help.open.value).toBe(true)
    on(key('?'))
    expect(help.open.value).toBe(false)
    help.show()
    on(key('Escape'))
    expect(help.open.value).toBe(false)
  })

  it('Majuscule+G ne démarre pas d’enchaînement', () => {
    const on = make()
    on(key('G', { shiftKey: true })); on(key('u'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('useShortcutsHelp : show / hide / toggle', () => {
    const h = useShortcutsHelp()
    h.show(); expect(h.open.value).toBe(true)
    h.toggle(); expect(h.open.value).toBe(false)
    h.show(); h.hide(); expect(h.open.value).toBe(false)
  })
})
