import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'

const baseUser = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33600', email: 'j@x.fr',
  city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false,
  averageRating: 4.5, totalTrips: 2, totalShipments: 3, createdAt: '2026-01-01',
  roles: ['SENDER'], stripeAccountStatus: 'ONBOARDING_COMPLETE', commissionRateOverride: null,
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 1, refusedCount: 0,
  senderHandoverIncidentCount: 0, ratingCount: 10, deletionRequestedAt: null,
}

describe('UserDetailPanel', () => {
  it('renders user profile and counters', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.text()).toContain('Jean Dupont')
    expect(w.text()).toContain('+33600')
  })
  it('shows Suspend/Ban for an ACTIVE user, not Unsuspend', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="action-suspend"]').exists()).toBe(true)
    expect(w.find('[data-test="action-ban"]').exists()).toBe(true)
    expect(w.find('[data-test="action-unsuspend"]').exists()).toBe(false)
  })
  it('shows Unsuspend for a SUSPENDED user', () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, status: 'SUSPENDED' }, open: true } })
    expect(w.find('[data-test="action-unsuspend"]').exists()).toBe(true)
  })
  it('emits suspend with reason via the confirm dialog', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="action-suspend"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('fraude')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('suspend')![0]).toEqual(['fraude'])
  })
})
