import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CorridorSection from '@/features/video-modals/components/CorridorSection.vue'
import { CORRIDORS_MAX } from '@/features/video-modals/types/index'

const mountSection = (props: Record<string, unknown> = {}) =>
  mount(CorridorSection, { props: { corridors: [], applies: true, ...props } })

describe('CorridorSection', () => {
  it('liste vide : tous les trajets, aide sur les accents et les majuscules', () => {
    const w = mountSection()
    expect(w.text()).toContain('Trajet ou colis précis')
    expect(w.text()).toContain('ville ou pays, sans tenir compte des accents ni des majuscules'.replace(/^./, c => c.toUpperCase()))
    expect(w.get('[data-test="vm-corridors-empty"]').text()).toContain('tous les trajets et colis')
    expect(w.get('[data-test="vm-corridor-count"]').text()).toBe('0 / 10')
    expect(w.find('[data-test="vm-corridor-0"]').exists()).toBe(false)
  })

  it('« Ajouter un trajet » émet ; « Retirer » émet l’index', async () => {
    const w = mountSection({ corridors: [{ from: 'Paris', to: 'Abidjan' }, { from: '', to: 'Dakar' }] })
    await w.get('[data-test="vm-corridor-add"]').trigger('click')
    expect(w.emitted('add')).toHaveLength(1)
    await w.get('[data-test="vm-corridor-remove-1"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual([1])
    expect(w.find('[data-test="vm-corridors-empty"]').exists()).toBe(false)
  })

  it('chaque côté est un champ : valeurs reprises, saisie émise avec la ligne et le côté', async () => {
    const w = mountSection({ corridors: [{ from: 'Paris', to: '' }] })
    const from = w.get('[data-test="vm-corridor-from-0"]')
    const to = w.get('[data-test="vm-corridor-to-0"]')
    expect((from.element as HTMLInputElement).value).toBe('Paris')
    expect((to.element as HTMLInputElement).value).toBe('')
    await to.setValue('Côte d’Ivoire')
    await from.setValue('Lyon')
    expect(w.emitted('set')).toEqual([[0, 'to', 'Côte d’Ivoire'], [0, 'from', 'Lyon']])
  })

  it('dix lignes au plus : le bouton d’ajout se bloque', () => {
    const w = mountSection({ corridors: Array.from({ length: CORRIDORS_MAX }, (_, i) => ({ from: `V${i}`, to: '' })) })
    expect(w.get('[data-test="vm-corridor-add"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="vm-corridor-count"]').text()).toBe('10 / 10')
    expect(mountSection({ corridors: [{ from: 'A', to: '' }] }).get('[data-test="vm-corridor-add"]').attributes('disabled')).toBeUndefined()
  })

  it('sans moment concerné coché : avertit que la liste est sans effet', () => {
    const w = mountSection({ corridors: [{ from: 'Paris', to: '' }], applies: false })
    expect(w.get('[data-test="vm-corridors-inactive"]').text()).toContain('Sans effet')
    expect(mountSection({ corridors: [{ from: 'Paris', to: '' }], applies: true }).find('[data-test="vm-corridors-inactive"]').exists()).toBe(false)
    expect(mountSection({ corridors: [], applies: false }).find('[data-test="vm-corridors-inactive"]').exists()).toBe(false)
  })

  it('erreur affichée', () => {
    expect(mountSection({ error: 'Trop long' }).get('[data-test="vm-corridors-error"]').text()).toBe('Trop long')
  })
})
