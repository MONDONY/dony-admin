import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { usersService } from '@/features/users/services/usersService'
import { useUserDetail } from '@/features/users/composables/useUserDetail'
import UserDetailPanel from '@/features/users/components/UserDetailPanel.vue'
import UserFilters from '@/features/users/components/UserFilters.vue'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const global = { stubs: { NuxtLink } }

const pendingUser = {
  id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33600', email: 'j@x.fr',
  city: 'Paris', country: 'FR', status: 'PENDING_DELETION', kycStatus: 'VERIFIED', isProAccount: false,
  averageRating: 4.5, totalTrips: 2, totalShipments: 3, createdAt: '2026-01-01',
  roles: ['SENDER'], stripeAccountStatus: null, commissionRateOverride: null,
  publishingSuspended: false, kiloPro: false, cancellationCount: 0, noShowCount: 0, refusedCount: 0,
  senderHandoverIncidentCount: 0, ratingCount: 0, deletionRequestedAt: '2026-09-01T10:00:00Z',
  deletionScheduledFor: '2026-10-01T10:00:00Z', messagingMutedUntil: null,
}
const activeUser = { ...pendingUser, status: 'ACTIVE', deletionRequestedAt: null, deletionScheduledFor: undefined }

describe('usersService.cancelDeletion', () => {
  beforeEach(() => apiMock.mockReset())
  it('POST /admin/users/{id}/cancel-deletion avec le motif', async () => {
    apiMock.mockResolvedValue(activeUser)
    await usersService.cancelDeletion('u1', 'demande retirée au support')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/cancel-deletion', { method: 'POST', body: { reason: 'demande retirée au support' } })
  })
  it('list passe status=PENDING_DELETION', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'PENDING_DELETION', role: null, kyc: null, pro: null, city: null, query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query).toMatchObject({ status: 'PENDING_DELETION' })
  })
})

describe('useUserDetail.cancelDeletion', () => {
  beforeEach(() => apiMock.mockReset())

  async function opened() {
    apiMock.mockResolvedValueOnce(pendingUser)
    const d = useUserDetail()
    await d.open('u1')
    return d
  }

  it('remplace la fiche par la réponse et rend true', async () => {
    const d = await opened()
    apiMock.mockResolvedValueOnce(activeUser)
    expect(await d.cancelDeletion('demande retirée au support')).toBe(true)
    expect(d.user.value?.status).toBe('ACTIVE')
    expect(d.busy.value).toBe(false)
  })

  it('409 user-deletion-not-cancellable : detail affiché', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(Object.assign(new Error('409'), {
      statusCode: 409, data: { code: 'user-deletion-not-cancellable', detail: 'La suppression est déjà exécutée.' },
    }))
    expect(await d.cancelDeletion('demande retirée au support')).toBe(false)
    expect(d.error.value).toBe('La suppression est déjà exécutée.')
    expect(d.cancelDeletionUnavailable.value).toBe(false)
  })

  it('endpoint absent : action masquée, pas d’erreur rouge', async () => {
    const d = await opened()
    apiMock.mockRejectedValueOnce(Object.assign(new Error('404'), { statusCode: 404, data: {} }))
    expect(await d.cancelDeletion('demande retirée au support')).toBe(false)
    expect(d.cancelDeletionUnavailable.value).toBe(true)
    expect(d.error.value).toBeNull()
  })

  it('sans fiche ouverte, ne fait rien', async () => {
    const d = useUserDetail()
    expect(await d.cancelDeletion('demande retirée au support')).toBe(false)
    expect(apiMock).not.toHaveBeenCalled()
  })
})

describe('UserFilters : suppression demandée', () => {
  it('propose le filtre « Suppression demandée »', async () => {
    const w = mount(UserFilters, { props: { modelStatus: 'TOUS', modelQuery: '' } })
    const chip = w.find('[data-test="chip-PENDING_DELETION"]')
    expect(chip.text()).toBe('Suppression demandée')
    await chip.trigger('click')
    expect(w.emitted('update:status')![0]).toEqual(['PENDING_DELETION'])
  })
})

describe('UserDetailPanel : compte en suppression', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('encart « Suppression prévue le … » et annulation motivée', async () => {
    const w = mount(UserDetailPanel, { props: { user: pendingUser, open: true }, global })
    expect(w.find('[data-test="user-pending-deletion"]').text()).toContain('Suppression prévue le 01/10/2026')
    await w.find('[data-test="action-cancel-deletion"]').trigger('click')
    expect(w.find('[data-test="restore-notice"]').text()).toMatch(/prévenu/)
    await w.find('[data-test="restore-reason"]').setValue('demande retirée au support')
    await w.find('[data-test="restore-confirm"]').trigger('click')
    expect(w.emitted('cancelDeletion')![0]).toEqual(['demande retirée au support'])
    expect(w.find('[data-test="restore-dialog"]').exists()).toBe(false)
  })

  it('sans date prévue, retombe sur la date de la demande', () => {
    const w = mount(UserDetailPanel, { props: { user: { ...pendingUser, deletionScheduledFor: undefined }, open: true }, global })
    expect(w.find('[data-test="user-pending-deletion"]').text()).toContain('Suppression demandée le 01/09/2026')
  })

  it('bouton masqué sans USER_DELETE', () => {
    seedAuth('SUPPORT')
    const w = mount(UserDetailPanel, { props: { user: pendingUser, open: true }, global })
    expect(w.find('[data-test="user-pending-deletion"]').exists()).toBe(true)
    expect(w.find('[data-test="action-cancel-deletion"]').exists()).toBe(false)
  })

  it('endpoint absent : bouton masqué et mention discrète', () => {
    const w = mount(UserDetailPanel, { props: { user: pendingUser, open: true, cancelDeletionUnavailable: true }, global })
    expect(w.find('[data-test="action-cancel-deletion"]').exists()).toBe(false)
    expect(w.find('[data-test="cancel-deletion-unavailable"]').exists()).toBe(true)
  })

  it('pas d’encart pour un compte actif', () => {
    const w = mount(UserDetailPanel, { props: { user: activeUser, open: true }, global })
    expect(w.find('[data-test="user-pending-deletion"]').exists()).toBe(false)
  })
})

describe('UserDetailPanel : envoyer une notification', () => {
  it('lien vers le composer pré-rempli avec NOTIFICATION_SEND', () => {
    seedAuth('ADMIN')
    const w = mount(UserDetailPanel, { props: { user: activeUser, open: true }, global })
    const link = w.find('[data-test="action-notify"]')
    expect(link.attributes('href')).toBe('/communications?target=USER&userId=u1')
    expect(link.text()).toBe('Envoyer une notification')
  })

  it('absent sans NOTIFICATION_SEND', () => {
    seedAuth('SUPPORT')
    const w = mount(UserDetailPanel, { props: { user: activeUser, open: true }, global })
    expect(w.find('[data-test="action-notify"]').exists()).toBe(false)
  })
})
