import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import UserIdentityTab from '@/features/user-profile/components/UserIdentityTab.vue'

const getKyc = vi.fn()
const resetKyc = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: { getKyc: (...a: unknown[]) => getKyc(...a), resetKyc: (...a: unknown[]) => resetKyc(...a) },
}))

const KycStub = {
  props: ['kyc', 'loading', 'error', 'busy', 'userName', 'heldPaymentsCount'],
  emits: ['reset', 'decided', 'stale'],
  template: '<div data-test="kyc-stub">{{ kyc?.kycStatus }}|{{ userName }}|{{ heldPaymentsCount }}</div>',
}
const USER = { id: 'u1', firstName: 'Awa', lastName: 'Diallo', heldPaymentsCount: 2 } as never
const KYC = { kycStatus: 'PENDING' }

function mountTab(user = USER) {
  return mount(UserIdentityTab, { props: { user }, global: { stubs: { UserKycTab: KycStub } } })
}

describe('UserIdentityTab', () => {
  beforeEach(() => {
    getKyc.mockReset(); resetKyc.mockReset(); seedAuth('ADMIN')
    getKyc.mockResolvedValue(KYC)
  })

  it('charge le KYC une seule fois à l’ouverture et transmet les props', async () => {
    const w = mountTab()
    await flushPromises()
    expect(getKyc).toHaveBeenCalledTimes(1)
    expect(getKyc).toHaveBeenCalledWith('u1')
    expect(w.get('[data-test="kyc-stub"]').text()).toBe('PENDING|Awa Diallo|2')
  })

  it('nom absent : null ; paiements retenus absents : 0', async () => {
    const w = mountTab({ id: 'u2' } as never)
    await flushPromises()
    expect(w.get('[data-test="kyc-stub"]').text()).toBe('PENDING||0')
  })

  it('reset : appelle la réinitialisation puis demande le rafraîchissement du détail', async () => {
    resetKyc.mockResolvedValue({ kycStatus: 'NONE' })
    const w = mountTab()
    await flushPromises()
    w.getComponent(KycStub).vm.$emit('reset', 'Pièce illisible')
    await flushPromises()
    expect(resetKyc).toHaveBeenCalledWith('u1', 'Pièce illisible')
    expect(w.emitted('refresh')).toHaveLength(1)
    expect(w.get('[data-test="kyc-stub"]').text()).toContain('NONE')
  })

  it('reset en échec : pas de rafraîchissement, erreur transmise', async () => {
    resetKyc.mockRejectedValue(new Error('boom'))
    const w = mountTab()
    await flushPromises()
    w.getComponent(KycStub).vm.$emit('reset', 'Motif')
    await flushPromises()
    expect(w.emitted('refresh')).toBeUndefined()
    expect(w.getComponent(KycStub).props('error')).toBeTruthy()
  })

  it('decided : remplace le KYC et rafraîchit le détail', async () => {
    const w = mountTab()
    await flushPromises()
    w.getComponent(KycStub).vm.$emit('decided', { kycStatus: 'VERIFIED' })
    await flushPromises()
    expect(w.get('[data-test="kyc-stub"]').text()).toContain('VERIFIED')
    expect(w.emitted('refresh')).toHaveLength(1)
  })

  it('stale : relit le KYC sans le vider', async () => {
    const w = mountTab()
    await flushPromises()
    getKyc.mockResolvedValue({ kycStatus: 'REJECTED' })
    w.getComponent(KycStub).vm.$emit('stale')
    await flushPromises()
    expect(getKyc).toHaveBeenCalledTimes(2)
    expect(w.get('[data-test="kyc-stub"]').text()).toContain('REJECTED')
  })
})
