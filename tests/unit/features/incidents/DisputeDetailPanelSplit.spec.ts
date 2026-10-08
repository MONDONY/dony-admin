import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DisputeDetailPanel from '@/features/incidents/components/DisputeDetailPanel.vue'
import type { AdminDisputeDetail, AdminDisputeSplitOptions } from '@/features/incidents/types/index'
import { seedAuth } from '~/tests/helpers/auth'

vi.mock('@/components/ui/StatusBadge.vue', () => ({ default: { name: 'StatusBadge', template: '<div></div>' } }))
vi.mock('@/components/ui/ConfirmActionDialog.vue', () => ({ default: { name: 'ConfirmActionDialog', template: '<div></div>', props: ['open', 'title', 'message', 'confirmLabel', 'requireReason'], emits: ['confirm', 'cancel'] } }))
vi.mock('@/features/incidents/components/GuaranteeFundForm.vue', () => ({ default: { name: 'GuaranteeFundForm', template: '<div></div>' } }))
vi.mock('@/features/incidents/components/SplitResolutionForm.vue', () => ({ default: { name: 'SplitResolutionForm', template: '<div data-test="split-form-stub"></div>', props: ['options'], emits: ['submit'] } }))

const dispute = { id: 'd1', type: 'RECIPIENT_NO_SHOW_CONTESTED', status: 'OPEN', bidId: 'b1', senderName: 'A', travelerName: 'B', refundFrozen: true, resolution: null } as unknown as AdminDisputeDetail
const options: AdminDisputeSplitOptions = { splittable: true, reasonCode: null, currency: 'EUR', amount: 105, commission: 5, refunded: 0, netAvailable: 100, rail: 'STRIPE', paymentStatus: 'ESCROW' }

describe('DisputeDetailPanel — partage (FLUTTER-E2)', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('admin avec droits argent : formulaire visible et partage relayé', async () => {
    const w = mount(DisputeDetailPanel, { props: { dispute, open: true, splitOptions: options } })
    const form = w.findComponent({ name: 'SplitResolutionForm' })
    expect(form.exists()).toBe(true)
    form.vm.$emit('submit', 30, 70, 'motif')
    expect(w.emitted('split')?.[0]).toEqual([30, 70, 'motif'])
  })

  it('sans droits de libération et remboursement : pas de formulaire', () => {
    seedAuth('ADMIN', { PAYMENT_RELEASE: false })
    const w = mount(DisputeDetailPanel, { props: { dispute, open: true, splitOptions: options } })
    expect(w.find('[data-test="split-form-stub"]').exists()).toBe(false)
  })

  it('back antérieur (pas d options) : pas de formulaire', () => {
    const w = mount(DisputeDetailPanel, { props: { dispute, open: true } })
    expect(w.find('[data-test="split-form-stub"]').exists()).toBe(false)
  })

  it('partage interrompu : état, erreur et reprise', async () => {
    const resolved = { ...dispute, status: 'RESOLVED', split: { id: 's1', senderRefundAmount: 30, travelerPayoutAmount: 70, currency: 'EUR', mode: 'REFUND_TRANSFER', status: 'SENDER_REFUNDED', attempts: 1, lastError: 'timeout', stripeRefundId: 're_1', stripeTransferId: null, completedAt: null } } as AdminDisputeDetail
    const w = mount(DisputeDetailPanel, { props: { dispute: resolved, open: true } })
    expect(w.find('[data-test="split-status"]').text()).toContain('versement voyageur à reprendre')
    expect(w.find('[data-test="split-error"]').text()).toContain('timeout')
    await w.find('[data-test="split-retry"]').trigger('click')
    expect(w.emitted('retry-split')).toHaveLength(1)
  })

  it('partage exécuté : pas de reprise', () => {
    const done = { ...dispute, status: 'RESOLVED', split: { id: 's1', senderRefundAmount: 30, travelerPayoutAmount: 70, currency: 'EUR', mode: 'REFUND_TRANSFER', status: 'COMPLETED', attempts: 0, lastError: null, stripeRefundId: 're_1', stripeTransferId: 'tr_1', completedAt: '2026-10-08T10:00:00' } } as AdminDisputeDetail
    const w = mount(DisputeDetailPanel, { props: { dispute: done, open: true } })
    expect(w.find('[data-test="split-status"]').text()).toBe('Exécuté')
    expect(w.find('[data-test="split-retry"]').exists()).toBe(false)
  })
})
