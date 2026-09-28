import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { useConversationThread } from '@/features/moderation/composables/useConversationThread'
import { useUserDetail } from '@/features/users/composables/useUserDetail'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import BroadcastComposer from '@/features/broadcast/components/BroadcastComposer.vue'
import { useBroadcast } from '@/features/broadcast/composables/useBroadcast'

const validation = (message: string) => Object.assign(new Error('422'), {
  statusCode: 422, data: { status: 422, detail: 'Validation failed', violations: [{ field: 'reason', message }] },
})
const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('useConversationThread : 204 et motif invalide', () => {
  beforeEach(() => apiMock.mockReset())

  it('204 sans corps : la conversation est relue', async () => {
    apiMock.mockImplementation((_url: string, opts?: { method?: string }) =>
      Promise.resolve(opts?.method === 'POST' ? undefined : []))
    const t = useConversationThread()
    await t.open('c1')
    apiMock.mockClear()
    expect(await t.restoreMessage('m1', 'suppression abusive')).toBe(true)
    expect(apiMock).toHaveBeenCalledWith('/admin/conversations/c1/messages')
  })

  it('422 violations : restoreReasonError, pas d’erreur rouge ni d’indisponibilité', async () => {
    apiMock.mockImplementation((_url: string, opts?: { method?: string }) =>
      opts?.method === 'POST' ? Promise.reject(validation('motif trop court')) : Promise.resolve([]))
    const t = useConversationThread()
    await t.open('c1')
    expect(await t.restoreMessage('m1', 'court mais')).toBe(false)
    expect(t.restoreReasonError.value).toBe('motif trop court')
    expect(t.restoreError.value).toBeNull()
    expect(t.restoreUnavailableIds.value).toEqual([])
  })
})

const pendingUser = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33600', email: 'j@x.fr', city: 'Paris', country: 'FR',
  status: 'PENDING_DELETION', kycStatus: 'VERIFIED', isProAccount: false, averageRating: null, totalTrips: 0,
  totalShipments: 0, createdAt: '2026-01-01', roles: [], stripeAccountStatus: null, commissionRateOverride: null,
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 0, refusedCount: 0,
  senderHandoverIncidentCount: 0, ratingCount: 0, deletionRequestedAt: '2026-09-01T10:00:00Z',
  deletionScheduledFor: '2026-10-01T10:00:00Z', messagingMutedUntil: null,
}

describe('useUserDetail.cancelDeletion : motif invalide', () => {
  beforeEach(() => apiMock.mockReset())
  it('422 violations : cancelDeletionReasonError, pas d’erreur de fiche', async () => {
    apiMock.mockResolvedValueOnce(pendingUser).mockRejectedValueOnce(validation('motif trop court'))
    const d = useUserDetail()
    await d.open('u1')
    expect(await d.cancelDeletion('court mais')).toBe(false)
    expect(d.cancelDeletionReasonError.value).toBe('motif trop court')
    expect(d.error.value).toBeNull()
  })
})

describe('UserDetailPanel : le dialogue d’annulation garde la saisie', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('reste ouvert après confirmation, affiche le refus du motif, et se ferme quand le compte est rétabli', async () => {
    const w = mount(UserDetailPanel, { props: { user: pendingUser, open: true }, global: { stubs: { NuxtLink } } })
    await w.find('[data-test="action-cancel-deletion"]').trigger('click')
    await w.find('[data-test="restore-reason"]').setValue('demande retirée au support')
    await w.find('[data-test="restore-confirm"]').trigger('click')
    expect(w.emitted('cancelDeletion')![0]).toEqual(['demande retirée au support'])
    await w.setProps({ cancelDeletionReasonError: 'motif trop court' })
    expect(w.find('[data-test="restore-error"]').text()).toBe('motif trop court')
    expect((w.find('[data-test="restore-reason"]').element as HTMLTextAreaElement).value).toBe('demande retirée au support')
    await w.setProps({ user: { ...pendingUser, status: 'ACTIVE' }, cancelDeletionReasonError: null })
    expect(w.find('[data-test="restore-dialog"]').exists()).toBe(false)
  })

  it('se ferme sur un refus métier (erreur de fiche)', async () => {
    const w = mount(UserDetailPanel, { props: { user: pendingUser, open: true }, global: { stubs: { NuxtLink } } })
    await w.find('[data-test="action-cancel-deletion"]').trigger('click')
    await w.setProps({ error: 'La suppression est déjà exécutée.' })
    expect(w.find('[data-test="restore-dialog"]').exists()).toBe(false)
  })

  it('se ferme quand l’endpoint se révèle absent', async () => {
    const w = mount(UserDetailPanel, { props: { user: pendingUser, open: true }, global: { stubs: { NuxtLink } } })
    await w.find('[data-test="action-cancel-deletion"]').trigger('click')
    await w.setProps({ cancelDeletionUnavailable: true })
    expect(w.find('[data-test="restore-dialog"]').exists()).toBe(false)
  })
})

describe('Broadcast : compte non joignable', () => {
  const UUID = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b'

  it('compte non joignable : avertissement et envoi désactivé', async () => {
    const w = mount(BroadcastComposer, { props: { recipientCount: null, initialUserId: UUID } })
    await w.find('[data-test="broadcast-title"]').setValue('Titre')
    await w.find('[data-test="broadcast-body"]').setValue('Corps')
    await w.setProps({ recipientCount: 0, targetUserName: 'Awa Diop', targetUserUnreachable: true })
    expect(w.find('[data-test="broadcast-user-unreachable"]').text()).toBe('Ce compte ne recevra pas la notification.')
    expect((w.find('[data-test="broadcast-send"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('joignable (ou champ absent) : envoi possible', async () => {
    const w = mount(BroadcastComposer, { props: { recipientCount: null, initialUserId: UUID } })
    await w.find('[data-test="broadcast-title"]').setValue('Titre')
    await w.find('[data-test="broadcast-body"]').setValue('Corps')
    await w.setProps({ recipientCount: 1, targetUserName: 'Awa Diop' })
    expect(w.find('[data-test="broadcast-user-unreachable"]').exists()).toBe(false)
    expect((w.find('[data-test="broadcast-send"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('useBroadcast garde targetUserReachable (null si absent ou en erreur)', async () => {
    apiMock.mockReset()
    apiMock.mockResolvedValueOnce({ recipientCount: 0, targetUserName: 'Awa Diop', targetUserReachable: false })
    const b = useBroadcast()
    await b.preview({ type: 'USER', userId: UUID })
    expect(b.targetUserReachable.value).toBe(false)
    expect(b.recipientCount.value).toBe(0)
    apiMock.mockResolvedValueOnce({ recipientCount: 5 })
    await b.preview({ type: 'ALL' })
    expect(b.targetUserReachable.value).toBeNull()
    apiMock.mockRejectedValueOnce(Object.assign(new Error('404'), { statusCode: 404, data: {} }))
    await b.preview({ type: 'USER', userId: UUID })
    expect(b.targetUserReachable.value).toBeNull()
  })
})
