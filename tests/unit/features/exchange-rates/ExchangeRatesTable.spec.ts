import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ExchangeRatesTable from '@/features/exchange-rates/components/ExchangeRatesTable.vue'
import type { ExchangeRate } from '@/features/exchange-rates/types/index'

const eur: ExchangeRate = { currency: 'EUR', unitsPerEur: 1, updatedAt: null, updatedBy: null }
const usd: ExchangeRate = {
  currency: 'USD', unitsPerEur: 1.08,
  updatedAt: '2026-08-10T09:00:00Z', updatedBy: 'admin-uuid',
}
const xof: ExchangeRate = { currency: 'XOF', unitsPerEur: 655.957, updatedAt: null, updatedBy: null }
const xaf: ExchangeRate = { currency: 'XAF', unitsPerEur: 655.957, updatedAt: null, updatedBy: null }

function mountTable(props: Partial<InstanceType<typeof ExchangeRatesTable>['$props']> = {}) {
  return mount(ExchangeRatesTable, {
    props: { rates: [eur, usd, xof, xaf], busy: false, ...props },
  })
}

describe('ExchangeRatesTable', () => {
  it('affiche la valeur et « jamais modifié » quand le taux n’a jamais été touché', () => {
    const w = mountTable()
    const value = w.find('[data-test="rate-value-EUR"]').element as HTMLInputElement
    expect(value.value).toBe('1')
    expect(w.find('[data-test="rate-meta-EUR"]').text()).toContain('Jamais modifié')
  })

  it('affiche la date de dernière modification pour un taux déjà modifié', () => {
    const w = mountTable()
    const meta = w.find('[data-test="rate-meta-USD"]').text()
    expect(meta).not.toContain('Jamais modifié')
  })

  it('XOF et XAF sont désactivés et affichent la mention parité fixe, aucun bouton Enregistrer', () => {
    const w = mountTable()
    expect((w.find('[data-test="rate-value-XOF"]').element as HTMLInputElement).disabled).toBe(true)
    expect(w.find('[data-test="rate-fixed-XOF"]').text()).toContain('non modifiable')
    expect(w.find('[data-test="rate-save-XOF"]').exists()).toBe(false)

    expect((w.find('[data-test="rate-value-XAF"]').element as HTMLInputElement).disabled).toBe(true)
    expect(w.find('[data-test="rate-save-XAF"]').exists()).toBe(false)
  })

  it('taux négatif ou nul désactive l’enregistrement et affiche le motif, sans appel réseau', async () => {
    const w = mountTable()
    await w.find('[data-test="rate-value-USD"]').setValue('0')

    const btn = w.find('[data-test="rate-save-USD"]').element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(w.find('[data-test="rate-error-USD"]').text()).toContain('strictement positif')

    await w.find('[data-test="rate-save-USD"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
  })

  it('taux au-delà de la borne maximale (10000) est refusé', async () => {
    const w = mountTable()
    await w.find('[data-test="rate-value-USD"]').setValue('10001')
    const btn = w.find('[data-test="rate-save-USD"]').element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(w.find('[data-test="rate-error-USD"]').text()).toContain('10000')
  })

  it('modifier un taux (dans les bornes) ouvre une confirmation avant d’émettre update', async () => {
    const w = mountTable()
    await w.find('[data-test="rate-value-USD"]').setValue('1.1')
    await w.find('[data-test="rate-save-USD"]').trigger('click')

    expect(w.find('[data-test="confirm"]').exists()).toBe(true)
    expect(w.emitted('update')).toBeUndefined()

    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('update')![0]).toEqual(['USD', 1.1])
  })

  it('annuler la confirmation n’émet pas update', async () => {
    const w = mountTable()
    await w.find('[data-test="rate-value-USD"]').setValue('1.1')
    await w.find('[data-test="rate-save-USD"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')

    expect(w.emitted('update')).toBeUndefined()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('les autres devises ne sont pas affectées par l’édition d’une seule', async () => {
    const w = mountTable()
    expect((w.find('[data-test="rate-value-EUR"]').element as HTMLInputElement).value).toBe('1')
    await w.find('[data-test="rate-value-USD"]').setValue('1.1')
    expect((w.find('[data-test="rate-value-EUR"]').element as HTMLInputElement).value).toBe('1')
  })

  it('les commandes sont désactivées pendant l’appel (busy) — sauf les devises à parité fixe, déjà désactivées', () => {
    const w = mountTable({ busy: true })
    expect((w.find('[data-test="rate-value-USD"]').element as HTMLInputElement).disabled).toBe(true)
    expect((w.find('[data-test="rate-save-USD"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})
