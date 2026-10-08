import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SplitResolutionForm from '@/features/incidents/components/SplitResolutionForm.vue'
import type { AdminDisputeSplitOptions } from '@/features/incidents/types/index'

const options: AdminDisputeSplitOptions = {
  splittable: true, reasonCode: null, currency: 'EUR', amount: 105, commission: 5, refunded: 0,
  netAvailable: 100, rail: 'STRIPE', paymentStatus: 'ESCROW',
}

async function fill(w: ReturnType<typeof mount>, sender: string, traveler: string, note = 'motif') {
  await w.find('[data-test="split-sender"]').setValue(sender)
  await w.find('[data-test="split-traveler"]').setValue(traveler)
  await w.find('[data-test="split-note"]').setValue(note)
}

describe('SplitResolutionForm (FLUTTER-E2)', () => {
  it('affiche le net disponible et le reliquat conservé', async () => {
    const w = mount(SplitResolutionForm, { props: { options } })
    expect(w.find('[data-test="split-net"]').text()).toBe('100.00 EUR')
    await fill(w, '30', '60')
    expect(w.find('[data-test="split-remainder"]').text()).toContain('10.00 EUR')
  })

  it('émet le partage quand il est valide', async () => {
    const w = mount(SplitResolutionForm, { props: { options } })
    await fill(w, '30.5', '69.5', '  partage  ')
    await w.find('[data-test="split-submit"]').trigger('click')
    expect(w.emitted('submit')?.[0]).toEqual([30.5, 69.5, 'partage'])
  })

  it('refuse une somme au-delà du net, des négatifs, zéro, ou sans motif', async () => {
    const w = mount(SplitResolutionForm, { props: { options } })
    await fill(w, '60', '40.01')
    expect(w.find('[data-test="split-problem"]').text()).toContain('dépasse le net')
    expect(w.find('[data-test="split-submit"]').attributes('disabled')).toBeDefined()
    await fill(w, '-1', '10')
    expect(w.find('[data-test="split-problem"]').text()).toContain('négatifs')
    await fill(w, '0', '0')
    expect(w.find('[data-test="split-problem"]').text()).toContain('positif')
    await fill(w, '10', '10', '')
    expect(w.find('[data-test="split-submit"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="split-submit"]').trigger('click')
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('franc CFA : pas de décimales', async () => {
    const w = mount(SplitResolutionForm, { props: { options: { ...options, currency: 'XOF', netAvailable: 50000, amount: 52500, commission: 2500 } } })
    await fill(w, '100.5', '0')
    expect(w.find('[data-test="split-problem"]').text()).toContain('trop précis')
    expect(w.find('[data-test="split-sender"]').attributes('step')).toBe('1')
  })

  it('partage impossible : raison lisible, aucun champ', () => {
    const w = mount(SplitResolutionForm, { props: { options: { ...options, splittable: false, reasonCode: 'split-mobile-money-unsupported' } } })
    expect(w.find('[data-test="split-unavailable"]').text()).toContain('mobile money')
    expect(w.find('[data-test="split-sender"]').exists()).toBe(false)
    const unknown = mount(SplitResolutionForm, { props: { options: { ...options, splittable: false, reasonCode: 'autre' } } })
    expect(unknown.find('[data-test="split-unavailable"]').text()).toContain('indisponible')
  })

  it('montant non numérique : invalide', async () => {
    const w = mount(SplitResolutionForm, { props: { options: { ...options, currency: null, netAvailable: null } } })
    const input = w.find('[data-test="split-sender"]')
    ;(input.element as HTMLInputElement).type = 'text'
    await input.setValue('abc')
    await w.find('[data-test="split-traveler"]').setValue('1')
    expect(w.find('[data-test="split-problem"]').text()).toContain('invalide')
  })
})
