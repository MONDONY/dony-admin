import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProvidersTable from '@/features/assistant/components/ProvidersTable.vue'
import type { AdminProvider } from '@/features/assistant/types'

const p = (slug: string, extra: Partial<AdminProvider> = {}): AdminProvider => ({
  id: slug, name: slug.toUpperCase(), slug, baseUrl: `https://api.${slug}.com/v1`, model: 'm', apiKeyLast4: '1234',
  supportsJsonMode: true, dailyRequestLimit: 1000, priority: 1, enabled: true,
  stats: { requestsToday: 12, successesToday: 10, lastStatus: null, lastError: null, cooldownUntil: null }, ...extra,
})

function mountTable(providers: AdminProvider[], extra = {}) {
  return mount(ProvidersTable, { props: { providers, testResults: {}, testingIds: new Set<string>(), ...extra } })
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
    const noSample = mountTable([p('a')], { testResults: { a: { ok: true, status: 200, latencyMs: 820, sample: null, error: null } } })
    expect(noSample.find('[data-test="provider-test-result-a"]').text()).toBe('OK en 820 ms')
    const blank = mountTable([p('a')], { testResults: { a: { ok: true, status: 200, latencyMs: 820, sample: '', error: null } } })
    expect(blank.find('[data-test="provider-test-result-a"]').text()).toBe('OK en 820 ms')
    const unknown = mountTable([p('a')], { testResults: { a: { ok: false, status: null, latencyMs: 0, sample: null, error: null } } })
    expect(unknown.find('[data-test="provider-test-result-a"]').text()).toContain('erreur inconnue')
  })

  it('adresse non analysable : affichée telle quelle', () => {
    expect(mountTable([p('a', { baseUrl: 'pas une url' })]).text()).toContain('pas une url')
  })

  it('test en cours : seul le bouton de CETTE ligne est désactivé', () => {
    const w = mountTable([p('a'), p('b'), p('c')], { testingIds: new Set(['a', 'c']) })
    expect(w.find('[data-test="provider-test-a"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="provider-test-a"]').text()).toBe('Test…')
    expect(w.find('[data-test="provider-test-b"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="provider-test-b"]').text()).toBe('Tester')
    expect(w.find('[data-test="provider-test-c"]').attributes('disabled')).toBeDefined()
  })

  it('affiche aussi les requêtes réussies du jour', () => {
    const w = mountTable([
      p('a'),
      p('b', { dailyRequestLimit: null }),
      p('c', { stats: { requestsToday: 3, successesToday: 1, lastStatus: null, lastError: null, cooldownUntil: null } }),
    ])
    const text = (slug: string) => w.find(`[data-test="provider-row-${slug}"]`).text().replace(/\s/g, ' ')
    expect(text('a')).toContain('12 / 1 000 · 10 réussies')
    expect(text('b')).toContain('12 · sans limite · 10 réussies')
    expect(text('c')).toContain('3 / 1 000 · 1 réussie')
    expect(text('c')).not.toContain('1 réussies')
  })

  it('glisser : renseigne dataTransfer (Firefox ne démarre pas le glisser sans)', async () => {
    const setData = vi.fn()
    const w = mountTable([p('a'), p('b')])
    await w.find('[data-test="provider-row-b"]').trigger('dragstart', { dataTransfer: { setData } })
    expect(setData).toHaveBeenCalledWith('text/plain', 'b')
  })

  it('envoi de l’ordre en cours : flèches et glisser désactivés', async () => {
    const w = mountTable([p('a'), p('b'), p('c')], { moving: true })
    for (const id of ['up-b', 'down-b', 'up-c', 'down-a']) {
      expect(w.find(`[data-test="provider-${id}"]`).attributes('disabled')).toBeDefined()
    }
    expect(w.find('[data-test="provider-row-a"]').attributes('draggable')).toBe('false')
    await w.find('[data-test="provider-row-c"]').trigger('dragstart')
    await w.find('[data-test="provider-row-a"]').trigger('drop')
    expect(w.emitted('move')).toBeUndefined()
  })

  it('liste vide', () => {
    expect(mountTable([]).find('[data-test="providers-empty"]').exists()).toBe(true)
  })
})
