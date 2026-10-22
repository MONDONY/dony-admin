import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StateBlock from '@/components/ui/StateBlock.vue'

describe('StateBlock', () => {
  it('chargement : annoncé aux lecteurs d’écran', () => {
    const w = mount(StateBlock, { props: { loading: true, empty: true } })
    expect(w.text()).toContain('Chargement')
    expect(w.attributes('role')).toBe('status')
  })

  it('échec : message et « Réessayer », prioritaire sur le vide', async () => {
    const w = mount(StateBlock, { props: { error: 'Impossible de charger les colis', empty: true } })
    expect(w.attributes('role')).toBe('alert')
    expect(w.text()).toContain('Impossible de charger les colis')
    expect(w.text()).not.toContain('Aucun résultat')
    await w.find('[data-test="state-retry"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('vide : libellé, piste et data-test personnalisé', () => {
    const w = mount(StateBlock, { props: { empty: true, emptyLabel: 'Aucun colis', hint: 'Modifiez les filtres', emptyTest: 'colis-empty' } })
    expect(w.find('[data-test="colis-empty"]').text()).toContain('Aucun colis')
    expect(w.text()).toContain('Modifiez les filtres')
  })

  it('vide : libellé et data-test par défaut', () => {
    const w = mount(StateBlock, { props: { empty: true } })
    expect(w.find('[data-test="state-empty"]').text()).toContain('Aucun résultat')
  })

  it('rien à montrer : ne rend rien', () => {
    const w = mount(StateBlock, { props: {} })
    expect(w.html()).toBe('<!--v-if-->')
  })

  it('le chargement l’emporte sur l’échec', () => {
    const w = mount(StateBlock, { props: { loading: true, error: 'x' } })
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
  })
})
