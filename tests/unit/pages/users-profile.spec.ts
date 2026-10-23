import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import type { AdminRole } from '@/stores/auth'

const ID = '8f2c1e0a-1111-4222-8333-9a8b7c6d5e4f'
const navigateToMock = vi.fn()
const replaceMock = vi.fn()
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: '', firebaseApiKey: '' } }))

const getMock = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({ usersService: { get: (...a: unknown[]) => getMock(...a) } }))
const overviewMock = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: { overview: (...a: unknown[]) => overviewMock(...a) },
}))

const NULLS = {
  parcelsInProgress: null, activeTrips: null, heldByCurrency: null, openDisputes: null, totalDisputes: null,
  reportsReceived: null, reportsSent: null, reportsPending: null, averageRating: null, ratingCount: null,
}
const USER = {
  id: ID, firstName: 'Awa', lastName: 'Diallo', phoneNumber: '+33612345678', email: 'awa@exemple.fr',
  city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false,
  roles: ['ROLE_SENDER', 'ROLE_TRAVELER'], createdAt: '2026-03-14T10:00:00Z', gpPro: true,
  commissionRateOverride: null, deletionScheduledFor: null,
}

async function mountPage(query: Record<string, string> = {}, id: string = ID, role: AdminRole = 'ADMIN') {
  seedAuth(role)
  vi.stubGlobal('useRoute', () => ({ params: { id }, query }))
  vi.resetModules()
  const mod = await import('@/pages/users/[id].vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  await flushPromises()
  return w
}

describe('users/[id].vue', () => {
  beforeEach(() => {
    navigateToMock.mockReset(); replaceMock.mockReset(); getMock.mockReset(); overviewMock.mockReset()
    getMock.mockResolvedValue(USER)
    overviewMock.mockResolvedValue({ kpis: { ...NULLS, parcelsInProgress: 2 }, inProgress: [], timeline: [] })
  })

  it('rend l’en-tête, les chiffres et l’onglet Vue d’ensemble', async () => {
    const w = await mountPage()
    expect(w.get('[data-test="profile-name"]').text()).toBe('Awa Diallo')
    expect(w.get('[data-test="profile-avatar"]').text()).toBe('AD')
    expect(w.find('[data-test="profile-actions-slot"]').exists()).toBe(true)
    expect(w.find('[data-test="kpi-parcels"]').exists()).toBe(true)
    expect(w.find('[data-test="tab-content-overview"]').exists()).toBe(true)
    expect(getMock).toHaveBeenCalledWith(ID)
    expect(overviewMock).toHaveBeenCalledWith(ID)
  })

  it('l’onglet Vue d’ensemble rend les éléments en cours et la frise', async () => {
    overviewMock.mockResolvedValue({
      kpis: NULLS,
      inProgress: [{ kind: 'PARCEL', id: 'b1', reference: 'DNY-001', corridor: 'Paris → Dakar', role: 'SENDER', status: 'IN_TRANSIT', updatedAt: '2026-10-20T10:00:00Z', amount: null }],
      timeline: [{ kind: 'PARCEL', title: 'Colis remis', detail: 'DNY-001', at: '2026-10-20T10:00:00Z', refType: 'PARCEL', refId: 'b1' }],
    })
    const w = await mountPage()
    expect(w.get('[data-test="tab-content-overview"]').findAll('[data-test="in-progress-row"]')).toHaveLength(1)
    expect(w.get('[data-test="tab-content-overview"]').findAll('[data-test="timeline-entry"]')).toHaveLength(1)
  })

  it('pas de bande d’alerte sans alerte, bande avec un compte suspendu', async () => {
    let w = await mountPage()
    expect(w.find('[data-test="alert-band-content"]').exists()).toBe(false)
    getMock.mockResolvedValue({ ...USER, status: 'SUSPENDED' })
    w = await mountPage()
    expect(w.get('[data-test="alert-band"]').text()).toContain('Compte suspendu')
  })

  it('?tab=money ouvre Argent', async () => {
    const w = await mountPage({ tab: 'money' })
    expect(w.find('[data-test="tab-content-money"]').exists()).toBe(true)
    expect(w.find('[data-test="tab-content-overview"]').exists()).toBe(false)
  })

  it('SUPPORT : pas d’onglet Gestion, ?tab=manage retombe sur la vue d’ensemble', async () => {
    const w = await mountPage({ tab: 'manage' }, ID, 'SUPPORT')
    expect(w.find('[data-test="tab-manage"]').exists()).toBe(false)
    expect(w.find('[data-test="tab-content-manage"]').exists()).toBe(false)
    expect(w.find('[data-test="tab-content-overview"]').exists()).toBe(true)
  })

  it('valeur de tab inconnue : vue d’ensemble', async () => {
    const w = await mountPage({ tab: 'nimporte' })
    expect(w.find('[data-test="tab-content-overview"]').exists()).toBe(true)
  })

  it('changer d’onglet met à jour ?tab= sans empiler l’historique', async () => {
    const w = await mountPage({ x: '1' })
    await w.get('[data-test="tab-money"]').trigger('click')
    expect(replaceMock).toHaveBeenCalledWith({ query: { x: '1', tab: 'money' } })
  })

  it('détail 404 : message et lien de retour', async () => {
    getMock.mockRejectedValue({ statusCode: 404, data: { code: 'user-not-found' } })
    const w = await mountPage()
    expect(w.text()).toContain('Utilisateur introuvable')
    expect(w.get('[data-test="back-to-users"]').attributes('href')).toBe('/users')
    expect(w.find('[data-test="profile-name"]').exists()).toBe(false)
  })

  it('identifiant invalide : introuvable, aucun appel API', async () => {
    const w = await mountPage({}, '../admin/x')
    expect(w.text()).toContain('Utilisateur introuvable')
    expect(getMock).not.toHaveBeenCalled()
    expect(overviewMock).not.toHaveBeenCalled()
  })

  it('autre erreur de détail : erreur avec Réessayer', async () => {
    getMock.mockRejectedValueOnce({ statusCode: 500, message: 'boom' })
    const w = await mountPage()
    expect(w.find('[data-test="state-error"]').exists()).toBe(true)
    await w.get('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="profile-name"]').exists()).toBe(true)
  })

  it('synthèse 404 sans code : repli drawer, une seule fois, replace', async () => {
    overviewMock.mockRejectedValue({ statusCode: 404 })
    const w = await mountPage()
    expect(navigateToMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith(`/users?open=${ID}&legacy=1`, { replace: true })
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
  })

  it('synthèse 500 : erreur Réessayer, en-tête conservé, pas de redirection', async () => {
    overviewMock.mockRejectedValueOnce({ statusCode: 500, message: 'boom' })
    const w = await mountPage()
    expect(w.get('[data-test="profile-name"]').exists()).toBe(true)
    expect(w.find('[data-test="state-error"]').exists()).toBe(true)
    expect(navigateToMock).not.toHaveBeenCalled()
    await w.get('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
    expect(w.find('[data-test="kpi-parcels"]').exists()).toBe(true)
  })

  it('copie l’identifiant', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountPage()
    await w.get('[data-test="copy-id"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith(ID)
  })

  it('repli sans nom : l’e-mail ou l’identifiant tronqué', async () => {
    getMock.mockResolvedValue({ ...USER, firstName: null, lastName: null, email: null, city: null, country: null })
    const w = await mountPage()
    expect(w.get('[data-test="profile-name"]').text()).toBe(ID.slice(0, 8))
  })

  it('panneaux d’onglet reliés à leur bouton', async () => {
    const w = await mountPage({ tab: 'money' })
    const panel = w.get('[data-test="tab-content-money"]')
    expect(panel.attributes('role')).toBe('tabpanel')
    expect(panel.attributes('aria-labelledby')).toBe('profile-tab-money')
    expect(w.find('#profile-tab-money').exists()).toBe(true)
  })

  it('changement de l’identifiant de la route : recharge et efface le compte précédent', async () => {
    const { reactive } = await import('vue')
    const ID_B = '11111111-2222-4333-8444-555555555555'
    seedAuth('ADMIN')
    const route = reactive({ params: { id: ID } as Record<string, string>, query: {} as Record<string, string> })
    vi.stubGlobal('useRoute', () => route)
    vi.resetModules()
    getMock.mockImplementation(async (id: string) => ({ ...USER, id, firstName: id === ID ? 'Awa' : 'Bob', lastName: 'X' }))
    const mod = await import('@/pages/users/[id].vue')
    const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    await flushPromises()
    expect(w.get('[data-test="profile-name"]').text()).toBe('Awa X')
    route.params.id = ID_B
    await flushPromises()
    expect(getMock).toHaveBeenLastCalledWith(ID_B)
    expect(overviewMock).toHaveBeenLastCalledWith(ID_B)
    expect(w.get('[data-test="profile-name"]').text()).toBe('Bob X')
    expect(w.text()).not.toContain('Awa')
  })

  it('changement vers un identifiant invalide : état introuvable, plus de données', async () => {
    const { reactive } = await import('vue')
    seedAuth('ADMIN')
    const route = reactive({ params: { id: ID } as Record<string, string>, query: {} as Record<string, string> })
    vi.stubGlobal('useRoute', () => route)
    vi.resetModules()
    const mod = await import('@/pages/users/[id].vue')
    const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    await flushPromises()
    route.params.id = 'pas-un-uuid'
    await flushPromises()
    expect(w.text()).toContain('Utilisateur introuvable')
    expect(w.find('[data-test="profile-name"]').exists()).toBe(false)
  })

  it('démontée pendant la synthèse : pas de redirection tardive', async () => {
    const pending = Promise.withResolvers<never>()
    overviewMock.mockReturnValue(pending.promise)
    const w = await mountPage()
    w.unmount()
    pending.reject({ statusCode: 404 })
    await flushPromises()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('statut KYC inconnu : jamais un badge vide', async () => {
    getMock.mockResolvedValue({ ...USER, kycStatus: 'WEIRD' })
    const w = await mountPage()
    expect(w.get('[data-test="profile-header"]').text()).toContain('WEIRD')
  })
})
