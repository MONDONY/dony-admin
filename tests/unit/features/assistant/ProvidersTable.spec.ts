import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProvidersTable from '@/features/assistant/components/ProvidersTable.vue'
import type { AdminProvider } from '@/features/assistant/types'

const p = (slug: string, extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id: slug, name: slug.toUpperCase(), slug, baseUrl: `https://api.${slug}.com/v1`, model: 'm', apiKeyLast4: '1234',
  supportsJsonMode: true, dailyRequestLimit: 1000, priority: 1, enabled: true,
  stats: { requestsToday: 12, successesToday: 10, lastStatus: null, lastError: null, cooldownUntil: null }, ...extra,
})

function mountTable(providers: AdminProvider[], extra = {}) {
  return mount(ProvidersTable, { props: { providers, testResults: {}, testingId: null, ...extra } })
}

describe('ProvidersTable', () => {
  it('affiche ordre, clé masquée, compteurs et état', () => {
    const w = mountTable([p('groq'), p('gemini', { enabled: false })])
    const row = w.find('[data-test="provider-row-groq"]')
    expect(row.text()).toContain('1. GROQ')
    expect(row.text()).toContain('••••1234')
    // Intl fr-FR sépare les milliers par une espace fine insécable : on la normalise.
    expect(row.text().replace(/\s/g, ' ')).toContain('12 / 1 000')
    expect(row.text()).toContain('Actif')
    expect(w.find('[data-test="provider-row-gemini"]').text()).toContain('En pause')
  })

  it('sans limite', () => {
    expect(mountTable([p('groq', { dailyRequestLimit: null })]).text()).toContain('12 · sans limite')
  })

  it('boutons Monter et Descendre émettent move, désactivés aux bords', async () => {
    const w = mountTable([p('a'), p('b')])
    expect(w.find('[data-test="provider-up-a"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="provider-down-b"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="provider-down-a"]').trigger('click')
    expect(w.emitted('move')?.[0]).toEqual([0, 1])
    await w.find('[data-test="provider-up-b"]').trigger('click')
    expect(w.emitted('move')?.[1]).toEqual([1, 0])
  })

  it('glisser-déposer émet move', async () => {
    const w = mountTable([p('a'), p('b'), p('c')])
    await w.find('[data-test="provider-row-c"]').trigger('dragstart')
    await w.find('[data-test="provider-row-a"]').trigger('drop')
    expect(w.emitted('move')?.[0]).toEqual([2, 0])
  })

  it('déposer une ligne sur elle-même, ou sans glissement, n’émet rien', async () => {
    const w = mountTable([p('a'), p('b')])
    await w.find('[data-test="provider-row-a"]').trigger('dragstart')
    await w.find('[data-test="provider-row-a"]').trigger('drop')
    await w.find('[data-test="provider-row-b"]').trigger('drop')
    await w.find('[data-test="provider-row-a"]').trigger('dragstart')
    await w.find('[data-test="provider-row-a"]').trigger('dragend')
    await w.find('[data-test="provider-row-b"]').trigger('drop')
    expect(w.emitted('move')).toBeUndefined()
  })

  it('actions', async () => {
    const w = mountTable([p('a')])
    await w.find('[data-test="provider-toggle-a"]').trigger('click')
    await w.find('[data-test="provider-test-a"]').trigger('click')
    await w.find('[data-test="provider-edit-a"]').trigger('click')
    await w.find('[data-test="provider-delete-a"]').trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
    expect(w.emitted('test')?.[0]).toEqual(['a'])
    expect(w.emitted('edit')).toHaveLength(1)
    expect(w.emitted('delete')).toHaveLength(1)
  })

  it('résultat de test', () => {
    const ok = mountTable([p('a')], { testResults: { a: { ok: true, status: 200, latencyMs: 820, sample: 'ok', error: null } } })
    expect(ok.find('[data-test="provider-test-result-a"]').text()).toContain('OK en 820 ms')
    const ko = mountTable([p('a')], { testResults: { a: { ok: false, status: 401, latencyMs: 90, sample: null, error: 'HTTP 401' } } })
    expect(ko.find('[data-test="provider-test-result-a"]').text()).toContain('HTTP 401')
    const unknown = mountTable([p('a')], { testResults: { a: { ok: false, status: null, latencyMs: 0, sample: null, error: null } } })
    expect(unknown.find('[data-test="provider-test-result-a"]').text()).toContain('erreur inconnue')
  })

  it('adresse non analysable : affichée telle quelle', () => {
    expect(mountTable([p('a', { baseUrl: 'pas une url' })]).text()).toContain('pas une url')
  })

  it('test en cours désactive le bouton', () => {
    expect(mountTable([p('a')], { testingId: 'a' }).find('[data-test="provider-test-a"]').attributes('disabled')).toBeDefined()
  })

  it('liste vide', () => {
    expect(mountTable([]).find('[data-test="providers-empty"]').exists()).toBe(true)
  })
})
