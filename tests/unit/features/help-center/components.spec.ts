import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({ contents: vi.fn(), article: vi.fn(), search: vi.fn(), ask: vi.fn() }))
vi.mock('@/features/help-center/services/helpCenterService', () => ({ helpCenterService: svc }))

import HelpMarkdown from '@/features/help-center/components/HelpMarkdown.vue'
import HelpSearchBox from '@/features/help-center/components/HelpSearchBox.vue'
import HelpAssistant from '@/features/help-center/components/HelpAssistant.vue'
import { _resetHelpAssistant, useHelpAssistant } from '@/features/help-center/composables/useHelpAssistant'
import { articleRoute, categoryIcon, searchRoute } from '@/features/help-center/lib/helpCategories'

const NuxtLink = {
  props: ['to'],
  emits: ['click'],
  template: '<a :href="typeof to === \'string\' ? to : to.path + \'?q=\' + to.query.q" @click="$emit(\'click\')"><slot /></a>',
}
const global = { stubs: { NuxtLink, Transition: false } }

describe('HelpMarkdown', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('rend les blocs sans HTML et relaie la navigation', async () => {
    const w = mount(HelpMarkdown, {
      props: { source: '## Titre\n### Sous\nTexte **gras** [lien](/colis)\n1. un\n- deux\n> **Attention :** stop\n\n> **Bon à savoir :** ok\n<script>x</script>' },
      global,
    })
    expect(w.find('h2').text()).toBe('Titre')
    expect(w.find('h3').text()).toBe('Sous')
    expect(w.find('strong').text()).toBe('gras')
    expect(w.find('ol li').text()).toBe('un')
    expect(w.find('ul li').text()).toBe('deux')
    expect(w.find('[data-test="help-callout-warning"]').exists()).toBe(true)
    expect(w.find('[data-test="help-callout-info"]').exists()).toBe(true)
    expect(w.find('script').exists()).toBe(false)
    expect(w.text()).toContain('<script>x</script>')
    await w.find('[data-test="help-inline-link"]').trigger('click')
    expect(w.emitted('navigate')).toHaveLength(1)
  })

  it('les liens des titres, listes et encadrés relaient aussi la navigation', async () => {
    const w = mount(HelpMarkdown, {
      props: { source: '## [a](/a)\n### [b](/b)\n1. [c](/c)\n\n- [d](/d)\n\n> [e](/e)' },
      global,
    })
    const links = w.findAll('[data-test="help-inline-link"]')
    expect(links).toHaveLength(5)
    for (const l of links) await l.trigger('click')
    expect(w.emitted('navigate')).toHaveLength(5)
  })

  it('un lien vers une page interdite au rôle devient du texte', () => {
    seedAuth('SUPPORT')
    const w = mount(HelpMarkdown, { props: { source: '[Admins](/administrateurs) [Colis](/colis?view=ACTIVE) [Fiche](/aide/x)' }, global })
    expect(w.findAll('[data-test="help-inline-link"]').map(l => l.attributes('href'))).toEqual(['/colis?view=ACTIVE', '/aide/x'])
    expect(w.find('[data-test="help-inline-locked"]').text()).toBe('Admins')
  })

  it('mode compact', () => {
    const w = mount(HelpMarkdown, { props: { source: '## T\n### S', compact: true }, global })
    expect(w.find('[data-test="help-markdown"]').classes()).toContain('text-sm')
  })
})

describe('HelpSearchBox', () => {
  it('frappe, Entrée, effacement et Échap', async () => {
    const w = mount(HelpSearchBox, { props: { modelValue: '', loading: true } })
    expect(w.find('[data-test="help-search-clear"]').exists()).toBe(false)
    await w.find('input').setValue('colis')
    expect(w.emitted('type')![0]).toEqual(['colis'])
    await w.setProps({ modelValue: 'colis' })
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')![0]).toEqual(['colis'])
    await w.find('[data-test="help-search-clear"]').trigger('click')
    expect(w.emitted('clear')).toHaveLength(1)
    await w.find('input').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('clear')).toHaveLength(2)
    ;(w.find('input').element as HTMLInputElement).value = ''
    await w.find('input').trigger('keydown', { key: 'Escape' })
    await w.find('input').trigger('keydown', { key: 'a' })
    expect(w.emitted('clear')).toHaveLength(2)
    ;(w.vm as unknown as { focus: () => void }).focus()
  })
})

describe('helpCategories', () => {
  it('icônes, liens de fiche et de recherche', () => {
    expect(categoryIcon('argent')).toBeTruthy()
    expect(categoryIcon('inconnue')).toBe(categoryIcon('premiers-pas'))
    expect(articleRoute('a b')).toBe('/aide/a%20b')
    expect(searchRoute('x')).toEqual({ path: '/aide', query: { q: 'x' } })
  })
})

describe('HelpAssistant', () => {
  beforeEach(() => { seedAuth('ADMIN'); _resetHelpAssistant(); svc.ask.mockReset() })

  const mountIt = () => mount(HelpAssistant, { global, attachTo: document.body })

  it('s’ouvre, propose des exemples et répond avec boutons et fiches', async () => {
    svc.ask.mockResolvedValue({
      answer: 'Ouvrez **Colis** :\n1. Vue **En cours**', answered: true,
      actions: [{ path: '/colis?view=ACTIVE', label: 'Ouvrir les colis en cours' }],
      sources: [{ id: 'voir-colis-en-cours', title: 'Voir les colis en cours' }], provider: 'groq', remaining: 3,
    })
    const w = mountIt()
    expect(w.find('[data-test="help-assistant-panel"]').exists()).toBe(false)
    await w.find('[data-test="help-assistant-trigger"]').trigger('click')
    expect(w.find('[data-test="help-assistant-empty"]').exists()).toBe(true)
    await w.findAll('[data-test="help-assistant-example"]')[0]!.trigger('click')
    await flushPromises()
    expect(svc.ask).toHaveBeenCalledWith('Comment voir les colis en cours ?', [])
    expect(w.find('[data-test="help-assistant-question"]').text()).toBe('Comment voir les colis en cours ?')
    expect(w.find('[data-test="help-assistant-answer"] strong').text()).toBe('Colis')
    expect(w.find('[data-test="help-assistant-action"]').attributes('href')).toBe('/colis?view=ACTIVE')
    expect(w.find('[data-test="help-assistant-source"]').attributes('href')).toBe('/aide/voir-colis-en-cours')
    expect(w.find('[data-test="help-assistant-remaining"]').text()).toContain('3 questions restantes')
    expect(w.find('[data-test="help-assistant-search-docs"]').exists()).toBe(false)
    w.unmount()
  })

  it('Entrée envoie, Maj+Entrée non ; l’échec propose la doc ; nouvelle conversation', async () => {
    svc.ask.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 429, data: { detail: 'Trop de questions' } }))
    useHelpAssistant().toggle(true)
    const w = mountIt()
    await nextTick()
    const input = w.find('[data-test="help-assistant-input"]')
    await input.setValue('colis')
    await input.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(svc.ask).not.toHaveBeenCalled()
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(w.find('[data-test="help-assistant-failure"]').text()).toContain('Trop de questions')
    expect(w.find('[data-test="help-assistant-search-docs"]').attributes('href')).toBe('/aide?q=colis')
    await w.find('[data-test="help-assistant-send"]').trigger('submit')
    expect(svc.ask).toHaveBeenCalledTimes(1)
    await w.find('[data-test="help-assistant-reset"]').trigger('click')
    expect(w.find('[data-test="help-assistant-empty"]').exists()).toBe(true)
    w.unmount()
  })

  it('pendant la réponse : indicateur ; Échap ferme ; le bouton bascule', async () => {
    let resolve: (_v: unknown) => void = () => {}
    svc.ask.mockReturnValue(new Promise(r => { resolve = r }))
    const w = mountIt()
    await w.find('[data-test="help-assistant-trigger"]').trigger('click')
    await w.find('[data-test="help-assistant-input"]').setValue('question')
    await w.find('form').trigger('submit')
    expect(w.find('[data-test="help-assistant-pending"]').exists()).toBe(true)
    resolve({ answer: 'Non couvert', answered: false, actions: [], sources: [], provider: 'g', remaining: 50 })
    await flushPromises()
    expect(w.find('[data-test="help-assistant-search-docs"]').exists()).toBe(true)
    expect(w.find('[data-test="help-assistant-remaining"]').exists()).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(useHelpAssistant().open.value).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.find('[data-test="help-assistant-trigger"]').trigger('click')
    expect(useHelpAssistant().open.value).toBe(true)
    await w.find('[data-test="help-assistant-trigger"]').trigger('click')
    expect(useHelpAssistant().open.value).toBe(false)
    await w.find('[data-test="help-assistant-trigger"]').trigger('click')
    await nextTick()
    await w.find('[data-test="help-assistant-close"]').trigger('click')
    expect(useHelpAssistant().open.value).toBe(false)
    w.unmount()
  })
})
