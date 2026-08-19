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
  senderHandoverIncidentCount: 0, ratingCount: 10, deletionRequestedAt: null, messagingMutedUntil: null,
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

  it('commission editor: apply with a valid input opens the confirm dialog without emitting', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="commission-input"]').setValue('8')
    await w.find('[data-test="commission-apply"]').trigger('click')
    expect(w.find('[data-test="overlay"]').exists()).toBe(true)
    expect(w.emitted('setCommission')).toBeUndefined()
  })

  it('commission editor: confirming the apply dialog emits the expected fraction', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="commission-input"]').setValue('8')
    await w.find('[data-test="commission-apply"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('setCommission')![0]).toEqual([0.08])
  })

  it('commission editor: cancelling the apply dialog emits nothing', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="commission-input"]').setValue('8')
    await w.find('[data-test="commission-apply"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.emitted('setCommission')).toBeUndefined()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('commission editor: reset opens the confirm dialog, then emits null on confirm', async () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, commissionRateOverride: 0.08 }, open: true } })
    await w.find('[data-test="commission-reset"]').trigger('click')
    expect(w.emitted('setCommission')).toBeUndefined()
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('setCommission')![0]).toEqual([null])
  })

  it('commission editor: the confirm dialog does not require a reason', async () => {
    const w = mount(UserDetailPanel, { props: { user: { ...baseUser, commissionRateOverride: 0.08 }, open: true } })
    await w.find('[data-test="commission-reset"]').trigger('click')
    expect(w.find('[data-test="reason"]').exists()).toBe(false)
  })

  it('commission editor: rejects a value above the back-end max (99.9 %) and does not open the dialog', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="commission-input"]').setValue('99.95')
    await w.find('[data-test="commission-apply"]').trigger('click')
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    expect(w.emitted('setCommission')).toBeUndefined()
  })

  it('commission editor: accepts the boundary value 99.9 % and emits the back-end max fraction on confirm', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="commission-input"]').setValue('99.9')
    await w.find('[data-test="commission-apply"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('setCommission')![0]).toEqual([0.999])
  })

  it('hides commission editor without USER_COMMISSION permission', () => {
    seedAuth('SUPPORT')
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="commission-input"]').exists()).toBe(false)
  })

  it('shows the mute duration selector and the mute button with USER_MESSAGE_MUTE', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="mute-duration"]').exists()).toBe(true)
    expect(w.find('[data-test="action-mute"]').exists()).toBe(true)
  })

  it('hides the mute duration selector and the mute button without USER_MESSAGE_MUTE', () => {
    seedAuth('SUPPORT')
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="mute-duration"]').exists()).toBe(false)
    expect(w.find('[data-test="action-mute"]').exists()).toBe(false)
  })

  it('mute: confirming with the default duration (24h) emits muteMessaging with the reason', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="action-mute"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('spam répété')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('muteMessaging')![0]).toEqual([24, 'spam répété'])
  })

  it('mute: selecting 7 jours emits muteMessaging with 168 hours', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="mute-duration"]').setValue('168')
    await w.find('[data-test="action-mute"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('spam')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('muteMessaging')![0]).toEqual([168, 'spam'])
  })

  it('mute: selecting indéfini emits muteMessaging with a null duration', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="mute-duration"]').setValue('indefinite')
    await w.find('[data-test="action-mute"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('abus répétés')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('muteMessaging')![0]).toEqual([null, 'abus répétés'])
  })

  it('mute: cancelling the dialog emits nothing', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="action-mute"]').trigger('click')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.emitted('muteMessaging')).toBeUndefined()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('mute: the confirm dialog requires a reason', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="action-mute"]').trigger('click')
    expect(w.find('[data-test="reason"]').exists()).toBe(true)
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
  })

  it('hides the unmute action when the user is not muted', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="action-unmute"]').exists()).toBe(false)
  })

  it('shows the unmute action and emits unmuteMessaging directly when the user is muted', async () => {
    const w = mount(UserDetailPanel, {
      props: { user: { ...baseUser, messagingMutedUntil: '2026-08-19T00:00:00Z' }, open: true },
    })
    expect(w.find('[data-test="action-unmute"]').exists()).toBe(true)
    await w.find('[data-test="action-unmute"]').trigger('click')
    expect(w.emitted('unmuteMessaging')).toBeTruthy()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
  })

  it('hides the unmute action without USER_MESSAGE_MUTE even if the user is muted', () => {
    seedAuth('SUPPORT')
    const w = mount(UserDetailPanel, {
      props: { user: { ...baseUser, messagingMutedUntil: '2026-08-19T00:00:00Z' }, open: true },
    })
    expect(w.find('[data-test="action-unmute"]').exists()).toBe(false)
  })

  it('messaging status shows Autorisée when the user is not muted', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="messaging-status"]').text()).toBe('Autorisée')
  })

  it('messaging status shows the mute deadline when the user is muted', () => {
    const w = mount(UserDetailPanel, {
      props: { user: { ...baseUser, messagingMutedUntil: '2026-08-19T00:00:00Z' }, open: true },
    })
    expect(w.find('[data-test="messaging-status"]').text()).toContain('Coupée jusqu\'au')
  })

  it('shows an error banner when the error prop is set', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true, error: 'Action échouée' } })
    expect(w.find('[data-test="user-error"]').text()).toBe('Action échouée')
  })

  it('disables the mute action while busy', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true, busy: true } })
    expect(w.find('[data-test="action-mute"]').attributes('disabled')).toBeDefined()
  })

  it('affiche l\'onglet Profil par défaut, avec toutes les actions de compte', () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="tab-profil"]').exists()).toBe(true)
    expect(w.find('[data-test="action-suspend"]').exists()).toBe(true)
    expect(w.find('[data-test="kyc-status"]').exists()).toBe(false)
  })

  it('bascule sur l\'onglet KYC et émet openKyc une seule fois', async () => {
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    await w.find('[data-test="tab-kyc"]').trigger('click')
    expect(w.emitted('openKyc')).toHaveLength(1)
    expect(w.find('[data-test="action-suspend"]').exists()).toBe(false)
  })

  it('cache l\'onglet KYC sans la permission USER_KYC', () => {
    seedAuth('ADMIN', { USER_KYC: false })
    const w = mount(UserDetailPanel, { props: { user: baseUser, open: true } })
    expect(w.find('[data-test="tab-kyc"]').exists()).toBe(false)
  })

  it('relaie l\'événement reset de l\'onglet KYC en resetKyc', async () => {
    const w = mount(UserDetailPanel, {
      props: { user: baseUser, open: true, kyc: {
        userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED',
        rejectionReason: null, rejectionCode: null, stripeSessionId: 'vs_001',
        stripeStatus: 'requires_input', stripeLastErrorCode: null, stripeLastErrorReason: null,
        stripeCreatedAt: null, stripeUnavailable: false,
      } },
    })
    await w.find('[data-test="tab-kyc"]').trigger('click')
    await w.find('[data-test="action-reset-kyc"]').trigger('click')
    await w.find('[data-test="reason"]').setValue('document illisible')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('resetKyc')![0]).toEqual(['document illisible'])
  })
})
