import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

const baseUser = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33600', email: 'j@x.fr',
  city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false,
  averageRating: 4.5, totalTrips: 2, totalShipments: 3, createdAt: '2026-01-01',
  roles: ['SENDER'], stripeAccountStatus: 'ONBOARDING_COMPLETE', commissionRateOverride: null,
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 1, refusedCount: 0,
  senderHandoverIncidentCount: 0, ratingCount: 10, deletionRequestedAt: null,
}

describe('UserDetailPanel', () => {
  beforeEach(() => seedAuth('ADMIN'))
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

  it('emits ban with reason via the confirm dialog', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="action-ban"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('abus répété')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('ban')![0]).toEqual(['abus répété'])
  })

  it('emits unsuspend directly without a dialog for a SUSPENDED user', async () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, status: 'SUSPENDED' }, open: true } })
    await w.find('[data-test="action-unsuspend"]').trigger('click')
    expect(w.emitted('unsuspend')).toBeTruthy()
    expect(w.find('[data-test="reason"]').exists()).toBe(false)
  })

  it('hides Suspend and Ban for a SUSPENDED user', () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, status: 'SUSPENDED' }, open: true } })
    expect(w.find('[data-test="action-suspend"]').exists()).toBe(false)
    expect(w.find('[data-test="action-ban"]').exists()).toBe(false)
  })

  it('shows suspend-publishing action for ADMIN when not suspended', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="action-suspend-publishing"]').exists()).toBe(true)
    expect(w.find('[data-test="action-lift-publishing"]').exists()).toBe(false)
  })

  it('shows lift-publishing action when publishing is suspended', () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, publishingSuspended: true }, open: true } })
    expect(w.find('[data-test="action-lift-publishing"]').exists()).toBe(true)
    expect(w.find('[data-test="action-suspend-publishing"]').exists()).toBe(false)
  })

  it('emits suspendPublishing with reason via the confirm dialog', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="action-suspend-publishing"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('annonces frauduleuses')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('suspendPublishing')![0]).toEqual(['annonces frauduleuses'])
  })

  it('hides publishing actions without USER_SUSPEND permission', () => {
    seedAuth('SUPPORT', { USER_SUSPEND: false })
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="action-suspend-publishing"]').exists()).toBe(false)
  })

  it('commission editor: converts percent input to fraction on apply', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="commission-input"]').setValue('8')
    await w.find('[data-test="commission-apply"]').trigger('click')
    expect(w.emitted('setCommission')![0]).toEqual([0.08])
  })

  it('commission editor: reset emits null', async () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, commissionRateOverride: 0.08 }, open: true } })
    await w.find('[data-test="commission-reset"]').trigger('click')
    expect(w.emitted('setCommission')![0]).toEqual([null])
  })

  it('hides commission editor without USER_COMMISSION permission', () => {
    seedAuth('SUPPORT')
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="commission-input"]').exists()).toBe(false)
  })
})
