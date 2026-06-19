import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DisputeDetailPanel from '@/features/incidents/components/DisputeDetailPanel.vue'
import type { AdminDisputeDetail } from '@/features/incidents/types/index'

vi.mock('@/components/ui/StatusBadge.vue', () => ({ default: { name: 'StatusBadge', template: '<div></div>' } }))
vi.mock('@/components/ui/ConfirmActionDialog.vue', () => ({ default: { name: 'ConfirmActionDialog', template: '<div></div>', props: ['open', 'title', 'message', 'confirmLabel', 'requireReason'], emits: ['confirm', 'cancel'] } }))
vi.mock('@/features/incidents/components/GuaranteeFundForm.vue', () => ({ default: { name: 'GuaranteeFundForm', template: '<div></div>', emits: ['submit'] } }))
vi.mock('@/features/incidents/components/disputeStatus.ts', () => ({ disputeStatusMeta: () => ({ status: 'open', label: 'Ouvert' }) }))

describe('DisputeDetailPanel', () => {
  const mockDispute: AdminDisputeDetail = {
    id: 'd1',
    type: 'Colis endommagé',
    status: 'OPEN',
    senderName: 'Alice',
    travelerName: 'Bob',
    bidId: 'bid-1',
    declaredValueEur: 150,
    refundFrozen: false,
    resolution: null,
  }

  it('renders when open is true', () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    expect(wrapper.text()).toContain('Colis endommagé')
    expect(wrapper.text()).toContain('Alice → Bob')
  })

  it('does not render when open is false', () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: false },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('emits close on background click', async () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    await wrapper.find('.bg-black\\/30').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on close button click', async () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    await wrapper.find('[data-test="dispute-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows resolution action buttons for OPEN status', () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    expect(wrapper.find('[data-test="resolve-sender"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="resolve-traveler"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="resolve-dismiss"]').exists()).toBe(true)
  })

  it('sets pending resolution when resolve-sender clicked', async () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    await wrapper.find('[data-test="resolve-sender"]').trigger('click')
    const dialog = wrapper.findComponent({ name: 'ConfirmActionDialog' })
    expect(dialog.props('open')).toBe(true)
  })

  it('emits resolve with correct resolution', async () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    await wrapper.find('[data-test="resolve-sender"]').trigger('click')
    const dialog = wrapper.findComponent({ name: 'ConfirmActionDialog' })
    await dialog.vm.$emit('confirm', 'litige résolu')
    const resolved = wrapper.emitted('resolve')
    expect(resolved).toHaveLength(1)
    expect(resolved![0]).toEqual(['RESOLVED_FOR_SENDER', 'litige résolu'])
  })

  it('emits guarantee event from form', async () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    const form = wrapper.findComponent({ name: 'GuaranteeFundForm' })
    await form.vm.$emit('submit', 10000, 'débours')
    const emitted = wrapper.emitted('guarantee')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]).toEqual([10000, 'débours'])
  })

  it('displays dispute details correctly', () => {
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: mockDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    expect(wrapper.text()).toContain('bid-1')
    expect(wrapper.text()).toContain('150 €')
    expect(wrapper.text()).toContain('Non')
  })

  it('displays resolution when present', () => {
    const disputeWithResolution = { ...mockDispute, resolution: 'RESOLVED_FOR_SENDER' }
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: disputeWithResolution, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    expect(wrapper.text()).toContain('RESOLVED_FOR_SENDER')
  })

  it('does not show action buttons for non-OPEN status', () => {
    const closedDispute = { ...mockDispute, status: 'RESOLVED' as any }
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: closedDispute, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    expect(wrapper.find('[data-test="resolve-sender"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="resolve-traveler"]').exists()).toBe(false)
  })

  it('displays n/a for missing sender/traveler names', () => {
    const disputeNoNames = { ...mockDispute, senderName: null, travelerName: null }
    const wrapper = mount(DisputeDetailPanel, {
      props: { dispute: disputeNoNames as any, open: true },
      global: { stubs: { StatusBadge: true, ConfirmActionDialog: true, GuaranteeFundForm: true } },
    })
    expect(wrapper.text()).toContain('— → —')
  })
})
