import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import { oldPayment, linkGlobal } from '~/tests/helpers/paymentDetail'
import { feeOf } from './cancellationFee.fixtures'

const svc = vi.hoisted(() => ({ getCancellationFee: vi.fn(), waiveCancellationFee: vi.fn(), retryCancellationFeePayout: vi.fn() }))
vi.mock('@/features/payments/services/paymentsService', () => ({ paymentsService: svc }))
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'

beforeEach(() => { Object.values(svc).forEach(f => f.mockReset()); seedAuth('ADMIN') })

describe('PaymentDetailPanel : carte Frais d’annulation', () => {
  it('le tiroir charge la retenue du colis et montre la carte', async () => {
    svc.getCancellationFee.mockResolvedValue(feeOf())
    const w = mount(PaymentDetailPanel, { props: { payment: oldPayment({ bidId: 'bid-1' }), open: true }, global: linkGlobal })
    await flushPromises()
    expect(svc.getCancellationFee).toHaveBeenCalledWith('bid-1')
    expect(w.find('[data-test="fee-card"]').exists()).toBe(true)
    expect(w.text()).toContain('Frais d’annulation')
  })
  it('sans retenue (404) : pas de carte, le tiroir reste intact', async () => {
    svc.getCancellationFee.mockResolvedValue(null)
    const w = mount(PaymentDetailPanel, { props: { payment: oldPayment({ bidId: 'bid-1' }), open: true }, global: linkGlobal })
    await flushPromises()
    expect(w.find('[data-test="fee-card"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-detail"]').exists()).toBe(true)
  })
  it('paiement sans colis (fil de négociation) : aucune lecture', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: oldPayment({ bidId: null }), open: true }, global: linkGlobal })
    await flushPromises()
    expect(svc.getCancellationFee).not.toHaveBeenCalled()
    expect(w.find('[data-test="fee-card"]').exists()).toBe(false)
  })
  it('lecture en erreur : la fiche reste utilisable, l’erreur est dans la zone de la carte', async () => {
    svc.getCancellationFee.mockRejectedValue({ statusCode: 500 })
    const w = mount(PaymentDetailPanel, { props: { payment: oldPayment({ bidId: 'bid-1' }), open: true }, global: linkGlobal })
    await flushPromises()
    expect(w.find('[data-test="fee-load-error"]').exists()).toBe(true)
    expect(w.find('[data-test="payment-error"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-actions-menu"]').exists()).toBe(true)
  })
})
