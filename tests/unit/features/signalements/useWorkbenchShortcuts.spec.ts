import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkbenchKeyHandler } from '@/features/signalements/composables/useWorkbenchShortcuts'

function key(k: string, init: Partial<Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey'>> = {}, target: Partial<HTMLElement & { type: string }> = { tagName: 'BODY' }) {
  const prevented = vi.fn()
  const e = { key: k, metaKey: false, ctrlKey: false, altKey: false, ...init, target, preventDefault: prevented } as unknown as KeyboardEvent
  return { e, prevented }
}

describe('createWorkbenchKeyHandler', () => {
  const deps = { enabled: vi.fn(() => true), move: vi.fn(), pick: vi.fn(), confirm: vi.fn() }
  const onKey = createWorkbenchKeyHandler(deps)

  beforeEach(() => {
    vi.clearAllMocks()
    deps.enabled.mockReturnValue(true)
  })

  it('J et K changent de signalement, en majuscule aussi', () => {
    onKey(key('j').e)
    onKey(key('K').e)
    expect(deps.move).toHaveBeenNthCalledWith(1, 1)
    expect(deps.move).toHaveBeenNthCalledWith(2, -1)
  })

  it('1 à 9 choisissent l’action ; 0 et les lettres ne font rien', () => {
    const { e, prevented } = key('3')
    onKey(e)
    expect(deps.pick).toHaveBeenCalledWith(3)
    expect(prevented).toHaveBeenCalled()
    onKey(key('0').e)
    onKey(key('a').e)
    expect(deps.pick).toHaveBeenCalledTimes(1)
  })

  it('les lettres propres au poste (keys) agissent, majuscule comprise, avec la même garde', () => {
    const v = vi.fn()
    const withKeys = createWorkbenchKeyHandler({ ...deps, keys: { v } })
    const first = key('V')
    withKeys(first.e)
    expect(v).toHaveBeenCalledTimes(1)
    expect(first.prevented).toHaveBeenCalled()
    withKeys(key('v', { metaKey: true }).e)
    withKeys(key('v', {}, { tagName: 'TEXTAREA' }).e)
    deps.enabled.mockReturnValue(false)
    withKeys(key('v').e)
    expect(v).toHaveBeenCalledTimes(1)
    deps.enabled.mockReturnValue(true)
    withKeys(key('x').e)
    expect(v).toHaveBeenCalledTimes(1)
  })

  it('⏎ confirme depuis la page', () => {
    onKey(key('Enter').e)
    expect(deps.confirm).toHaveBeenCalledTimes(1)
  })

  it('⏎ sur un bouton ou un lien garde son rôle natif', () => {
    onKey(key('Enter', {}, { tagName: 'BUTTON' }).e)
    onKey(key('Enter', {}, { tagName: 'A' }).e)
    expect(deps.confirm).not.toHaveBeenCalled()
  })

  it('dans un champ de saisie : rien, sauf ⌘⏎ / Ctrl⏎ qui confirme', () => {
    const textarea = { tagName: 'TEXTAREA' }
    onKey(key('j', {}, textarea).e)
    onKey(key('1', {}, textarea).e)
    onKey(key('Enter', {}, textarea).e)
    expect(deps.move).not.toHaveBeenCalled()
    expect(deps.pick).not.toHaveBeenCalled()
    expect(deps.confirm).not.toHaveBeenCalled()
    onKey(key('Enter', { metaKey: true }, textarea).e)
    onKey(key('Enter', { ctrlKey: true }, textarea).e)
    expect(deps.confirm).toHaveBeenCalledTimes(2)
  })

  it('une case ou un bouton radio ne bloquent pas les raccourcis (le focus y reste après un clic)', () => {
    onKey(key('2', {}, { tagName: 'INPUT', type: 'radio' }).e)
    onKey(key('Enter', {}, { tagName: 'INPUT', type: 'checkbox' }).e)
    expect(deps.pick).toHaveBeenCalledWith(2)
    expect(deps.confirm).toHaveBeenCalledTimes(1)
  })

  it('un champ texte ou de recherche bloque les raccourcis', () => {
    onKey(key('j', {}, { tagName: 'INPUT', type: 'search' }).e)
    onKey(key('4', {}, { tagName: 'INPUT', type: 'text' }).e)
    expect(deps.move).not.toHaveBeenCalled()
    expect(deps.pick).not.toHaveBeenCalled()
  })

  it('un champ éditable et une liste déroulante bloquent aussi', () => {
    onKey(key('j', {}, { tagName: 'DIV', isContentEditable: true }).e)
    onKey(key('j', {}, { tagName: 'SELECT' }).e)
    expect(deps.move).not.toHaveBeenCalled()
  })

  it('Alt, ⌘ ou Ctrl avec une lettre : ignoré (⌘K reste à la recherche globale)', () => {
    onKey(key('j', { altKey: true }).e)
    onKey(key('k', { metaKey: true }).e)
    onKey(key('1', { ctrlKey: true }).e)
    expect(deps.move).not.toHaveBeenCalled()
    expect(deps.pick).not.toHaveBeenCalled()
  })

  it('désactivé (fenêtre ouverte) : rien ne bouge, ⌘⏎ non plus', () => {
    deps.enabled.mockReturnValue(false)
    onKey(key('j').e)
    onKey(key('Enter').e)
    onKey(key('Enter', { metaKey: true }).e)
    expect(deps.move).not.toHaveBeenCalled()
    expect(deps.confirm).not.toHaveBeenCalled()
  })
})
