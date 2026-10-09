import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserRecetteBulkBar from '@/features/users/components/UserRecetteBulkBar.vue'

const base = { count: 12, totalMatching: 40, busy: false, selectingAll: false, truncated: false }

describe('UserRecetteBulkBar', () => {
  it('affiche le nombre et confirme l’activation avec le nombre de comptes', async () => {
    const w = mount(UserRecetteBulkBar, { props: base })
    expect(w.get('[data-test="recette-bulk-count"]').text()).toBe('12 sélectionnés')
    await w.get('[data-test="recette-bulk-enable"]').trigger('click')
    expect(w.get('[data-test="recette-bulk-confirm"]').text()).toContain('Passer 12 comptes en mode recette ?')
    await w.get('[data-test="recette-bulk-confirm-button"]').trigger('click')
    expect(w.emitted('apply')?.[0]).toEqual([true])
    expect(w.find('[data-test="recette-bulk-confirm"]').exists()).toBe(false)
  })

  it('désactivation : question au singulier, annulation sans émission', async () => {
    const w = mount(UserRecetteBulkBar, { props: { ...base, count: 1 } })
    expect(w.get('[data-test="recette-bulk-count"]').text()).toBe('1 sélectionné')
    await w.get('[data-test="recette-bulk-disable"]').trigger('click')
    expect(w.text()).toContain('Retirer 1 compte du mode recette ?')
    await w.get('[data-test="recette-bulk-cancel"]').trigger('click')
    expect(w.emitted('apply')).toBeUndefined()
    await w.get('[data-test="recette-bulk-disable"]').trigger('click')
    await w.get('[data-test="recette-bulk-confirm-button"]').trigger('click')
    expect(w.emitted('apply')?.[0]).toEqual([false])
  })

  it('propose de sélectionner tous les résultats du filtre, plafonnés à 200', async () => {
    const w = mount(UserRecetteBulkBar, { props: base })
    expect(w.get('[data-test="recette-select-all"]').text()).toBe('Sélectionner les 40 résultats du filtre')
    await w.get('[data-test="recette-select-all"]').trigger('click')
    expect(w.emitted('select-all-matching')).toHaveLength(1)

    await w.setProps({ totalMatching: 500 })
    expect(w.get('[data-test="recette-select-all"]').text()).toBe('Sélectionner les 200 premiers résultats du filtre')

    await w.setProps({ truncated: true, count: 200 })
    expect(w.find('[data-test="recette-select-all"]').exists()).toBe(false)
    expect(w.get('[data-test="recette-truncated"]').text()).toContain('200 premiers résultats')
  })

  it('tout est déjà sélectionné : pas de proposition ; chargement : boutons désactivés', async () => {
    const w = mount(UserRecetteBulkBar, { props: { ...base, totalMatching: 12, busy: true } })
    expect(w.find('[data-test="recette-select-all"]').exists()).toBe(false)
    expect(w.get('[data-test="recette-bulk-enable"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="recette-bulk-enable"]').text()).toBe('Enregistrement…')
  })

  it('désélectionner émet clear ; une sélection vidée ferme la confirmation', async () => {
    const w = mount(UserRecetteBulkBar, { props: base })
    await w.get('[data-test="recette-bulk-clear"]').trigger('click')
    expect(w.emitted('clear')).toHaveLength(1)
    await w.get('[data-test="recette-bulk-enable"]').trigger('click')
    await w.setProps({ count: 0 })
    expect(w.find('[data-test="recette-bulk-confirm"]').exists()).toBe(false)
  })
})
