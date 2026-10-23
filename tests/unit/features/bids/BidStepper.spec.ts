/** Frise d'étapes du tiroir : rend `bidStepper(bid)`. */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidStepper from '@/features/bids/components/BidStepper.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'

const bid = (over: Partial<AdminBidDetail> = {}) => ({
  id: 'b1', status: 'ACCEPTED', createdAt: '2026-10-06T18:53:35', ...over,
}) as AdminBidDetail

describe('BidStepper', () => {
  it('stepper_renders : six étapes, faites, courante, à venir, date de création à Paris', () => {
    const w = mount(BidStepper, { props: { bid: bid() } })
    expect(w.find('[data-test="bid-stepper"]').attributes('role')).toBe('list')
    const steps = w.findAll('[data-test^="step-"]')
    expect(steps.map(s => s.attributes('data-test'))).toEqual(
      ['step-created', 'step-paid', 'step-accepted', 'step-handed', 'step-transit', 'step-delivered'])
    expect(steps.map(s => s.attributes('data-state'))).toEqual(['done', 'done', 'done', 'current', 'todo', 'todo'])
    expect(w.find('[data-test="step-handed"]').attributes('aria-current')).toBe('step')
    expect(w.findAll('[aria-current="step"]')).toHaveLength(1)
    expect(w.find('[data-test="step-created"]').text()).toContain('Créé')
    expect(w.find('[data-test="step-created"]').text()).toContain('06/10/2026 20:53')
    expect(w.find('[data-test="step-handed"]').text()).toContain('En cours')
    expect(w.find('[data-test="stepper-ended"]').exists()).toBe(false)
  })

  it('livré : date du jour de livraison ; date seule lue telle quelle', () => {
    const w = mount(BidStepper, { props: { bid: bid({ status: 'COMPLETED', createdAt: '2026-10-06',
      milestones: { handoverLocation: null, handoverDeadline: null, arrivedAt: null, deliveredAt: '2026-10-14T10:00:00Z', noShowAt: null, returnedAt: null } }) } })
    expect(w.findAll('[data-state="done"]')).toHaveLength(6)
    expect(w.find('[data-test="step-delivered"]').text()).toContain('14/10/2026 12:00')
    expect(w.find('[data-test="step-created"]').text()).toContain('mardi 6 octobre 2026')
  })

  it('statut terminal : bandeau de fin, aucune étape courante', () => {
    const cancelled = mount(BidStepper, { props: { bid: bid({ status: 'CANCELLED' }) } })
    expect(cancelled.find('[data-test="stepper-ended"]').text()).toBe('Annulé')
    expect(cancelled.find('[data-test="stepper-ended"]').attributes('data-tone')).toBe('neutral')
    expect(cancelled.find('[aria-current="step"]').exists()).toBe(false)
    const noShow = mount(BidStepper, { props: { bid: bid({ status: 'NO_SHOW' }) } })
    expect(noShow.find('[data-test="stepper-ended"]').attributes('data-tone')).toBe('danger')
  })
})
