import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentFilters from '@/features/payments/components/PaymentFilters.vue'

function mountFilters(props = {}) {
  return mount(PaymentFilters, {
    props: {
      modelMethod: 'TOUS',
      modelCurrency: 'TOUTES',
      modelDateFrom: null,
      modelDateTo: null,
      ...props,
    },
  })
}

describe('PaymentFilters', () => {
  it('menu méthode : Toutes / Carte / Mobile money, et rien d’autre', async () => {
    const w = mountFilters()
    const sel = w.find('[data-test="filter-method"]')
    expect(sel.findAll('option').map(o => o.text())).toEqual(['Toutes', 'Carte', 'Mobile money'])
    await sel.setValue('PAWAPAY')
    expect(w.emitted('update:method')?.[0]).toEqual(['PAWAPAY'])
    await sel.setValue('STRIPE')
    expect(w.emitted('update:method')?.[1]).toEqual(['STRIPE'])
  })

  it('menu devise : émet la devise choisie', async () => {
    const w = mountFilters()
    const sel = w.find('[data-test="filter-currency"]')
    expect(sel.findAll('option').map(o => o.attributes('value'))).toEqual(['TOUTES', 'EUR', 'USD', 'CAD', 'GBP', 'CHF', 'XOF', 'XAF'])
    await sel.setValue('XOF')
    expect(w.emitted('update:currency')?.[0]).toEqual(['XOF'])
  })

  it('plus de pastilles de statut ni de champ de recherche', () => {
    const w = mountFilters()
    expect(w.find('[data-test^="chip-status-"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-search"]').exists()).toBe(false)
  })

  it('émet les dates et les efface', async () => {
    const w = mountFilters({ modelDateFrom: '2026-06-01' })
    await w.find('[data-test="date-from"]').setValue('2026-06-01')
    await w.find('[data-test="date-to"]').setValue('2026-06-30')
    await w.find('[data-test="dates-clear"]').trigger('click')
    expect(w.emitted('update:dateRange')?.[0]).toEqual(['2026-06-01', null])
    expect(w.emitted('update:dateRange')?.[1]).toEqual(['2026-06-01', '2026-06-30'])
    expect(w.emitted('update:dateRange')?.[2]).toEqual([null, null])
  })

  it('montant : saisie en unités principales, émis en centimes', async () => {
    const w = mountFilters()
    await w.find('[data-test="amount-min"]').setValue('100')
    await w.find('[data-test="amount-max"]').setValue('250,5')
    expect(w.emitted('update:amountRange')?.[0]).toEqual([10000, null])
    expect(w.emitted('update:amountRange')?.[1]).toEqual([10000, 25050])
  })

  it('montant : saisie invalide ignorée, champ vidé = borne retirée', async () => {
    const w = mountFilters({ modelAmountMin: 10000 })
    await w.find('[data-test="amount-max"]').setValue('abc')
    await w.find('[data-test="amount-max"]').setValue('-5')
    await w.find('[data-test="amount-max"]').setValue('1.234')
    expect(w.emitted('update:amountRange')).toBeUndefined()
    await w.find('[data-test="amount-min"]').setValue('')
    expect(w.emitted('update:amountRange')?.[0]).toEqual([null, null])
  })

  it('montant initial affiché en unités principales', () => {
    const w = mountFilters({ modelAmountMin: 1250, modelAmountMax: 10000 })
    expect((w.find('[data-test="amount-min"]').element as HTMLInputElement).value).toBe('12.5')
    expect((w.find('[data-test="amount-max"]').element as HTMLInputElement).value).toBe('100')
  })

  it('« Plus de filtres » : disclosure fermée par défaut, ouverte au clic', async () => {
    const w = mountFilters()
    const btn = w.find('[data-test="more-filters"]')
    expect(btn.attributes('aria-expanded')).toBe('false')
    expect(w.find('[data-test="more-filters-panel"]').attributes('style')).toContain('display: none')
    await btn.trigger('click')
    expect(btn.attributes('aria-expanded')).toBe('true')
    expect(w.find('[data-test="more-filters-panel"]').attributes('style') ?? '').not.toContain('display: none')
  })

  it('« Plus de filtres » s’ouvre d’office si un de ses filtres est actif', () => {
    expect(mountFilters({ modelHeld: true }).find('[data-test="more-filters"]').attributes('aria-expanded')).toBe('true')
    expect(mountFilters({ modelHideAbandoned: false }).find('[data-test="more-filters"]').attributes('aria-expanded')).toBe('true')
  })

  it('bascule « Checkouts abandonnés » : libellé et émission', async () => {
    const w = mountFilters({ modelHideAbandoned: true })
    const chip = w.find('[data-test="chip-abandoned"]')
    expect(chip.text()).toBe('Afficher les checkouts abandonnés')
    await chip.trigger('click')
    expect(w.emitted('update:hideAbandoned')?.[0]).toEqual([false])
    await w.setProps({ modelHideAbandoned: false })
    expect(w.find('[data-test="chip-abandoned"]').text()).toBe('Checkouts abandonnés affichés')
  })
})
