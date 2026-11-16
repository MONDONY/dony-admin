import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const svc = vi.hoisted(() => ({ contents: vi.fn(), article: vi.fn(), search: vi.fn(), ask: vi.fn() }))
vi.mock('@/features/help-center/services/helpCenterService', () => ({ helpCenterService: svc }))

import { _resetHelpContents, useHelpContents } from '@/features/help-center/composables/useHelpContents'
import { SEARCH_DELAY_MS, useHelpSearch } from '@/features/help-center/composables/useHelpSearch'
import { useHelpArticle } from '@/features/help-center/composables/useHelpArticle'
import { ASSISTANT_DISABLED, ASSISTANT_UNAVAILABLE, HISTORY_SENT, _resetHelpAssistant, useHelpAssistant } from '@/features/help-center/composables/useHelpAssistant'

const httpError = (status: number, data?: Record<string, unknown>) => Object.assign(new Error(`[GET] ${status}`), { statusCode: status, data })
const CONTENTS = {
  categories: [{ id: 'comptes', label: 'Comptes' }, { id: 'argent', label: 'Argent' }],
  articles: [{ id: 'a', title: 'A', category: 'comptes', summary: '', permission: null, accessible: true, routes: [] }],
  assistantEnabled: true,
}

describe('useHelpContents', () => {
  beforeEach(() => { _resetHelpContents(); Object.values(svc).forEach(f => f.mockReset()) })

  it('charge une fois, partage le sommaire, groupe par rubrique', async () => {
    svc.contents.mockResolvedValue(CONTENTS)
    const h = useHelpContents()
    await Promise.all([h.load(), useHelpContents().load()])
    await h.load()
    expect(svc.contents).toHaveBeenCalledTimes(1)
    expect(h.sections.value.map(s => s.id)).toEqual(['comptes'])
    expect(h.categoryLabel('argent')).toBe('Argent')
    expect(h.categoryLabel('zzz')).toBe('zzz')
    await h.load(true)
    expect(svc.contents).toHaveBeenCalledTimes(2)
  })

  it('sans sommaire, pas de rubrique ni de libellé connu', () => {
    const h = useHelpContents()
    expect(h.sections.value).toEqual([])
    expect(h.categoryLabel('comptes')).toBe('comptes')
  })

  it('back ancien : indisponible ; autre échec : message', async () => {
    svc.contents.mockRejectedValueOnce(httpError(404))
    const h = useHelpContents()
    await h.load()
    expect(h.unavailable.value).toBe(true)
    expect(h.error.value).toBeNull()
    svc.contents.mockRejectedValueOnce(httpError(500, { detail: 'Panne' }))
    await h.load(true)
    expect(h.unavailable.value).toBe(false)
    expect(h.error.value).toBe('Panne')
  })
})

describe('useHelpSearch', () => {
  beforeEach(() => { vi.useFakeTimers(); svc.search.mockReset() })
  afterEach(() => vi.useRealTimers())

  it('attend une pause de frappe et ne garde que la dernière réponse', async () => {
    let first: (_v: unknown) => void = () => {}
    svc.search.mockReturnValueOnce(new Promise(r => { first = r }))
    svc.search.mockResolvedValueOnce({ query: 'colis en cours', results: [{ id: 'b' }] })
    const s = useHelpSearch()
    s.type('co')
    s.type('col')
    vi.advanceTimersByTime(SEARCH_DELAY_MS)
    expect(svc.search).toHaveBeenCalledTimes(1)
    expect(svc.search).toHaveBeenCalledWith('col')
    const second = s.now('colis en cours')
    first({ query: 'col', results: [{ id: 'a' }] })
    await second
    expect(s.results.value).toEqual([{ id: 'b' }])
    expect(s.answeredFor.value).toBe('colis en cours')
    expect(s.isLoading.value).toBe(false)
  })

  it('texte vide : rien ; échec : message', async () => {
    const s = useHelpSearch()
    await s.now('   ')
    expect(svc.search).not.toHaveBeenCalled()
    expect(s.answeredFor.value).toBeNull()
    svc.search.mockRejectedValueOnce(httpError(500))
    await s.now('x')
    expect(s.error.value).toBe('La recherche a échoué')
    s.type('y')
    s.clear()
    vi.advanceTimersByTime(SEARCH_DELAY_MS)
    expect(s.query.value).toBe('')
    expect(svc.search).toHaveBeenCalledTimes(1)
  })

  it('dans un composant, la frappe en attente est annulée au démontage', async () => {
    const { mount } = await import('@vue/test-utils')
    const { defineComponent, h } = await import('vue')
    let s!: ReturnType<typeof useHelpSearch>
    const w = mount(defineComponent({ setup() { s = useHelpSearch(); return () => h('div') } }))
    s.type('colis')
    w.unmount()
    vi.advanceTimersByTime(SEARCH_DELAY_MS)
    expect(svc.search).not.toHaveBeenCalled()
  })

  it('un échec d’une requête dépassée est ignoré', async () => {
    let reject: (_e: unknown) => void = () => {}
    svc.search.mockReturnValueOnce(new Promise((_r, j) => { reject = j }))
    svc.search.mockResolvedValueOnce({ query: 'b', results: [] })
    const s = useHelpSearch()
    const a = s.now('a')
    await s.now('b')
    reject(httpError(500))
    await a
    expect(s.error.value).toBeNull()
  })
})

describe('useHelpArticle', () => {
  beforeEach(() => svc.article.mockReset())

  it('charge, fiche inconnue, erreur, réponse dépassée', async () => {
    const h = useHelpArticle()
    svc.article.mockResolvedValueOnce({ id: 'a' })
    await h.load('a')
    expect(h.article.value).toEqual({ id: 'a' })
    svc.article.mockRejectedValueOnce(httpError(404, { code: 'admin-help-article-not-found' }))
    await h.load('x')
    expect(h.notFound.value).toBe(true)
    expect(h.article.value).toBeNull()
    svc.article.mockRejectedValueOnce(httpError(500))
    await h.load('y')
    expect(h.error.value).toBe('Impossible de charger cette fiche')
    let slow: (_v: unknown) => void = () => {}
    svc.article.mockReturnValueOnce(new Promise(r => { slow = r }))
    svc.article.mockRejectedValueOnce(httpError(500))
    const p = h.load('old')
    await h.load('new')
    slow({ id: 'old' })
    await p
    expect(h.article.value).toBeNull()
    let late: (_e: unknown) => void = () => {}
    svc.article.mockReturnValueOnce(new Promise((_r, j) => { late = j }))
    svc.article.mockResolvedValueOnce({ id: 'ok' })
    const q = h.load('old2')
    await h.load('ok')
    late(httpError(500))
    await q
    expect(h.article.value).toEqual({ id: 'ok' })
  })
})

describe('useHelpAssistant', () => {
  beforeEach(() => { _resetHelpAssistant(); svc.ask.mockReset() })

  it('envoie la question avec l’historique et garde la réponse', async () => {
    svc.ask.mockResolvedValue({ answer: 'Réponse', answered: true, actions: [{ path: '/colis', label: 'Colis' }], sources: [], provider: 'groq', remaining: 4 })
    const a = useHelpAssistant()
    expect(await a.send('  Où sont les colis ?  ')).toBe(true)
    expect(svc.ask).toHaveBeenCalledWith('Où sont les colis ?', [])
    await a.send('Et après ?')
    expect(svc.ask).toHaveBeenLastCalledWith('Et après ?', [
      { role: 'user', text: 'Où sont les colis ?' }, { role: 'assistant', text: 'Réponse' },
    ])
    expect(a.messages.value).toHaveLength(4)
    expect(a.remaining.value).toBe(4)
    expect(useHelpAssistant().messages.value).toHaveLength(4)
  })

  it('n’envoie ni question vide ni deux questions à la fois', async () => {
    let resolve: (_v: unknown) => void = () => {}
    svc.ask.mockReturnValue(new Promise(r => { resolve = r }))
    const a = useHelpAssistant()
    expect(await a.send('  ')).toBe(false)
    const first = a.send('Q1')
    expect(await a.send('Q2')).toBe(false)
    a.reset()
    expect(a.messages.value).toHaveLength(1)
    resolve({ answer: 'R', answered: true, provider: 'none', remaining: 1 })
    await first
    expect(a.messages.value[1]).toMatchObject({ actions: [], sources: [] })
    a.reset()
    expect(a.messages.value).toEqual([])
  })

  it('les échecs s’affichent sans repartir vers le modèle', async () => {
    const a = useHelpAssistant()
    svc.ask.mockRejectedValueOnce(httpError(404, { code: 'admin-help-assistant-disabled' }))
    await a.send('A')
    svc.ask.mockRejectedValueOnce(httpError(404))
    await a.send('B')
    svc.ask.mockRejectedValueOnce(httpError(429, { detail: 'Quota atteint' }))
    await a.send('C')
    svc.ask.mockRejectedValueOnce(httpError(500))
    await a.send('D')
    const failures = a.messages.value.filter(m => m.failed).map(m => m.text)
    expect(failures).toEqual([ASSISTANT_DISABLED, ASSISTANT_UNAVAILABLE, 'Quota atteint', 'L’assistant n’a pas pu répondre. Réessayez dans un instant.'])
    expect(a.history.value.every(t => t.role === 'user')).toBe(true)
  })

  it('n’envoie que les derniers tours et bascule l’ouverture', async () => {
    svc.ask.mockResolvedValue({ answer: 'R', answered: true, actions: [], sources: [], provider: 'g', remaining: 1 })
    const a = useHelpAssistant()
    for (let i = 0; i < 6; i++) await a.send(`Q${i}`)
    expect(a.history.value).toHaveLength(HISTORY_SENT)
    a.toggle()
    expect(a.open.value).toBe(true)
    a.toggle(false)
    expect(a.open.value).toBe(false)
  })
})
