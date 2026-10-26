import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useReplyDrafts } from '@/features/support/composables/useReplyDrafts'

describe('useReplyDrafts', () => {
  beforeEach(() => { sessionStorage.clear() })

  it('un brouillon par ticket, relu à la demande', () => {
    const d = useReplyDrafts()
    d.set('t1', 'Bonjour')
    d.set('t2', 'Merci')
    expect(d.get('t1')).toBe('Bonjour')
    expect(d.get('t2')).toBe('Merci')
    expect(d.get('t3')).toBe('')
  })

  it('un brouillon vide ou fait d’espaces disparaît ; clear aussi', () => {
    const d = useReplyDrafts()
    d.set('t1', 'Bonjour')
    d.set('t1', '   ')
    expect(d.get('t1')).toBe('')
    d.set('t2', 'x')
    d.clear('t2')
    expect(d.get('t2')).toBe('')
  })

  it('survit à un rechargement de la page (sessionStorage)', () => {
    useReplyDrafts().set('t1', 'À finir')
    expect(useReplyDrafts().get('t1')).toBe('À finir')
  })

  it('un stockage illisible repart à vide', () => {
    sessionStorage.setItem('yadony-admin-support-drafts', '{pas du json')
    expect(useReplyDrafts().get('t1')).toBe('')
    sessionStorage.setItem('yadony-admin-support-drafts', '[1,2]')
    expect(useReplyDrafts().get('t1')).toBe('')
    sessionStorage.setItem('yadony-admin-support-drafts', 'null')
    expect(useReplyDrafts().get('t1')).toBe('')
  })

  it('sans stockage : le brouillon vit en mémoire sans erreur', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const d = useReplyDrafts()
    d.set('t1', 'Bonjour')
    expect(d.get('t1')).toBe('Bonjour')
    spy.mockRestore()
  })
})
