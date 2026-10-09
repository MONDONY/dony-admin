import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserFilters from '@/features/users/components/UserFilters.vue'

describe('UserFilters', () => {
  it('emits status and search query changes', async () => {
    const wrapper = mount(UserFilters, {
      props: { modelStatus: 'TOUS', modelQuery: '' },
    })

    await wrapper.find('[data-test="chip-SUSPENDED"]').trigger('click')
    await wrapper.find('[data-test="search"]').setValue('awa@example.com')
    await wrapper.find('[data-test="search"]').trigger('keyup.enter')

    expect(wrapper.emitted('update:status')?.[0]).toEqual(['SUSPENDED'])
    expect(wrapper.emitted('update:query')?.[0]).toEqual(['awa@example.com'])
  })

  it('annonce la recherche par UID Firebase ou identifiant, avec une aide au survol', () => {
    const input = mount(UserFilters, { props: { modelStatus: 'TOUS', modelQuery: '' } }).find('[data-test="search"]')
    expect(input.attributes('placeholder')).toBe('Nom, e-mail, téléphone, UID ou identifiant')
    expect(input.attributes('title')).toBe("L'UID Firebase et l'identifiant doivent être collés en entier.")
    expect(input.attributes('placeholder')).not.toContain('\u2014')
    expect(input.attributes('title')).not.toContain('\u2014')
  })

  it('émet la saisie sans changer la casse (un UID Firebase y est sensible)', async () => {
    const wrapper = mount(UserFilters, { props: { modelStatus: 'TOUS', modelQuery: '' } })
    const input = wrapper.find('[data-test="search"]')
    await input.setValue('aB3xYz9QkLmN0pRsTuVwXyZ12345')
    await input.trigger('keyup.enter')
    expect(wrapper.emitted('update:query')?.[0]).toEqual(['aB3xYz9QkLmN0pRsTuVwXyZ12345'])
  })
})

describe('UserFilters — filtre testeurs recette', () => {
  it('caché par défaut', () => {
    const w = mount(UserFilters, { props: { modelStatus: 'TOUS', modelQuery: '' } })
    expect(w.find('[data-test="chip-recette"]').exists()).toBe(false)
  })

  it('bascule le filtre', async () => {
    const w = mount(UserFilters, { props: { modelStatus: 'TOUS', modelQuery: '', showRecette: true } })
    const chip = w.get('[data-test="chip-recette"]')
    expect(chip.attributes('aria-pressed')).toBe('false')
    await chip.trigger('click')
    expect(w.emitted('update:recette')?.[0]).toEqual([true])
    await w.setProps({ modelRecette: true })
    await w.get('[data-test="chip-recette"]').trigger('click')
    expect(w.emitted('update:recette')?.[1]).toEqual([false])
  })
})
