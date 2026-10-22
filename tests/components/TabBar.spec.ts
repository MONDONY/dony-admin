import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TabBar, { type TabItem } from '@/components/ui/TabBar.vue'

type Id = 'a' | 'b' | 'c'
const tabs: TabItem<Id>[] = [
  { id: 'a', label: 'Alpha', group: 'Un' },
  { id: 'b', label: 'Beta', group: 'Un' },
  { id: 'c', label: 'Gamma', group: 'Deux', count: 120 },
]
const mountBar = (modelValue: Id = 'a', extra = {}) =>
  mount(TabBar, { props: { tabs, modelValue, ...extra }, attachTo: document.body })

describe('TabBar', () => {
  it('marque l’onglet actif avec aria-pressed et garde les data-test', () => {
    const w = mountBar('b')
    expect(w.find('[data-test="tab-b"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test="tab-a"]').attributes('aria-pressed')).toBe('false')
    w.unmount()
  })

  it('regroupe les onglets consécutifs sous une étiquette', () => {
    const w = mountBar()
    expect(w.find('[data-test="tab-group-Un"]').text()).toContain('Un')
    expect(w.find('[data-test="tab-group-Un"]').findAll('button')).toHaveLength(2)
    expect(w.find('[data-test="tab-group-Deux"]').findAll('button')).toHaveLength(1)
    w.unmount()
  })

  it('sans groupe, pas d’étiquette', () => {
    const w = mount(TabBar, { props: { tabs: [{ id: 'x', label: 'X' }], modelValue: 'x' } })
    expect(w.find('span.uppercase').exists()).toBe(false)
  })

  it('émet le nouvel onglet au clic, pas pour l’onglet déjà actif', async () => {
    const w = mountBar('a')
    await w.find('[data-test="tab-c"]').trigger('click')
    await w.find('[data-test="tab-a"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['c']])
    w.unmount()
  })

  it('les flèches, Début et Fin déplacent la sélection en boucle', async () => {
    const w = mountBar('a')
    await w.find('[data-test="tab-a"]').trigger('keydown', { key: 'ArrowRight' })
    await w.find('[data-test="tab-a"]').trigger('keydown', { key: 'ArrowLeft' })
    await w.find('[data-test="tab-c"]').trigger('keydown', { key: 'ArrowRight' })
    await w.find('[data-test="tab-b"]').trigger('keydown', { key: 'Home' })
    await w.find('[data-test="tab-b"]').trigger('keydown', { key: 'End' })
    await w.find('[data-test="tab-b"]').trigger('keydown', { key: 'x' })
    // L'onglet actif reste « a » (la prop n'est pas mise à jour ici) : viser « a » n'émet donc rien.
    expect(w.emitted('update:modelValue')).toEqual([['b'], ['c'], ['c']])
    w.unmount()
  })

  it('affiche une pastille de compte plafonnée à 99+, masquée à zéro', () => {
    const w = mount(TabBar, { props: { tabs: [...tabs, { id: 'd' as Id, label: 'Delta', count: 0 }], modelValue: 'a' } })
    const counts = w.findAll('[data-test="tab-count"]')
    expect(counts).toHaveLength(1)
    expect(counts[0]!.text()).toBe('99+')
  })

  it('variante soulignée et préfixe de data-test personnalisés', () => {
    const w = mountBar('a', { variant: 'underline', testPrefix: 'sig-tab' })
    expect(w.find('[data-test="sig-tab-a"]').classes()).toContain('border-primary')
    expect(w.attributes('class')).toContain('border-b')
    w.unmount()
  })
})
