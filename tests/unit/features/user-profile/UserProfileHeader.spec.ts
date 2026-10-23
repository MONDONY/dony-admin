import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UserProfileHeader from '@/features/user-profile/components/UserProfileHeader.vue'

const USER = {
  id: '8f2c1e0a-1111-4222-8333-9a8b7c6d5e4f', firstName: 'Awa', lastName: 'Diallo', phoneNumber: '+33612345678',
  email: 'awa@exemple.fr', city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false,
  roles: ['ROLE_SENDER'], createdAt: '2026-10-31T23:30:00Z', gpPro: false, commissionRateOverride: null,
}
const mountH = (o: Record<string, unknown> = {}) => mount(UserProfileHeader, { props: { user: { ...USER, ...o } as never } })

describe('UserProfileHeader', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('dérogation de commission : fraction affichée en pourcentage avec la virgule française', () => {
    expect(mountH({ commissionRateOverride: 0.08 }).text()).toContain('Commission : 8,0 %')
    expect(mountH({ commissionRateOverride: 0.125 }).text()).toContain('Commission : 12,5 %')
    expect(mountH({ commissionRateOverride: 0 }).text()).toContain('Commission : 0,0 %')
  })

  it('pas de dérogation (null ou champ absent) : « taux global »', () => {
    expect(mountH().text()).toContain('Commission : taux global')
    const { commissionRateOverride: _omit, ...rest } = USER
    expect(mount(UserProfileHeader, { props: { user: rest as never } }).text()).toContain('Commission : taux global')
  })

  it('nom de repli : e-mail, puis début de l’identifiant', () => {
    expect(mountH({ firstName: null, lastName: null }).get('[data-test="profile-name"]').text()).toBe('awa@exemple.fr')
    expect(mountH({ firstName: null, lastName: null, email: null }).get('[data-test="profile-name"]').text()).toBe(USER.id.slice(0, 8))
  })

  it('date d’inscription : jour de Paris (le 31 à 23 h 30 UTC est déjà le 1er novembre)', () => {
    expect(mountH().text()).toContain('Inscrit le 1 novembre 2026')
  })

  it('copie de l’identifiant', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = mountH()
    await w.get('[data-test="copy-id"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(USER.id)
    expect(w.get('[data-test="copy-id"]').text()).toBe('Copié')
  })

  it('presse-papiers refusé : aucune erreur, bouton inchangé', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    const w = mountH()
    await w.get('[data-test="copy-id"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="copy-id"]').text()).toBe('Copier l’ID')
  })
})
