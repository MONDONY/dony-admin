import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewVolumesTable from '@/features/overview/components/OverviewVolumesTable.vue'

const rows = [
  { currency: 'EUR', escrowHeld: '1 234,56 EUR', released: '5 000,00 EUR', refunded: '100,00 EUR', commission: '600,00 EUR' },
  { currency: 'XOF', escrowHeld: '9 900,00 XOF', released: '19 800,00 XOF', refunded: '0,00 XOF', commission: '1 800,00 XOF' },
]

describe('OverviewVolumesTable', () => {
  it('une ligne par devise, chaque montant dans sa devise', () => {
    const w = mount(OverviewVolumesTable, { props: { rows } })
    expect(w.find('[data-test="volume-row-EUR"]').text()).toContain('EUR')
    const xof = w.find('[data-test="volume-row-XOF"]')
    expect(xof.find('[data-test="volume-escrow-XOF"]').text()).toBe('9 900,00 XOF')
    expect(xof.find('[data-test="volume-released-XOF"]').text()).toBe('19 800,00 XOF')
    expect(xof.find('[data-test="volume-commission-XOF"]').text()).toBe('1 800,00 XOF')
    expect(xof.text()).not.toContain('€')
    expect(w.find('[data-test="volumes-empty"]').exists()).toBe(false)
  })

  it('état vide sans aucun paiement', () => {
    const w = mount(OverviewVolumesTable, { props: { rows: [] } })
    expect(w.find('[data-test="volumes-empty"]').text()).toMatch(/Aucun paiement/)
    expect(w.findAll('tbody tr')).toHaveLength(0)
  })
})
