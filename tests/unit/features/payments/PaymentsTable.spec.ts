import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import { formatMoney } from '@/features/payments/types/index'

const payments = [
  { id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 12345, commissionCents: 1480, currency: 'EUR', createdAt: '2026-06-01T10:00:00Z' },
  // Recette du 2026-09-09 : 6 600 XOF s'affichaient « 6 600,00 € ».
  { id: 'p2', bidId: 'b2', status: 'RELEASED', method: 'PAWAPAY', amountCents: 660000, commissionCents: 60000, currency: 'XOF', createdAt: '2026-09-09T15:09:00Z' },
]

describe('PaymentsTable', () => {
  it('renders rows with formatted amount + emits select', async () => {
    const w = mount(PaymentsTable, { props: { payments, loading: false } })
    expect(w.text()).toContain('Sous séquestre'); expect(w.text()).toContain('123,45')
    await w.find('[data-test="payment-row-p1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['p1'])
  })
  it('affiche chaque montant dans la devise du paiement, jamais en euros par défaut', () => {
    const w = mount(PaymentsTable, { props: { payments, loading: false } })
    expect(w.find('[data-test="payment-amount-p1"]').text()).toBe(formatMoney(12345, 'EUR'))
    expect(w.find('[data-test="payment-amount-p2"]').text()).toBe(formatMoney(660000, 'XOF'))
    expect(w.find('[data-test="payment-row-p2"]').text()).not.toContain('€')
  })
  it('traduit le rail en libellé lisible', () => {
    const w = mount(PaymentsTable, { props: { payments, loading: false } })
    expect(w.find('[data-test="payment-row-p1"]').text()).toContain('Carte')
    expect(w.find('[data-test="payment-row-p2"]').text()).toContain('Mobile money')
  })
  it('formatMoney : sans devise connue, le montant sort nu, jamais « undefined » ni en euros', () => {
    expect(formatMoney(12345, undefined)).toBe(formatMoney(12345, 'EUR').replace(' EUR', ''))
    expect(formatMoney(12345, undefined)).not.toContain('undefined')
    expect(formatMoney(12345, undefined)).not.toContain('€')
  })
  it('empty state', () => { expect(mount(PaymentsTable, { props: { payments: [], loading: false } }).text()).toMatch(/Aucun paiement/i) })
})
