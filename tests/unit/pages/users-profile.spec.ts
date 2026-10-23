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
const getKycMock = vi.fn()
const suspendMock = vi.fn()
const cancelDeletionMock = vi.fn()
const setCommissionMock = vi.fn()
const impactMock = vi.fn()
const deleteUserMock = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: {
    get: (...a: unknown[]) => getMock(...a), getKyc: (...a: unknown[]) => getKycMock(...a),
    suspend: (...a: unknown[]) => suspendMock(...a), cancelDeletion: (...a: unknown[]) => cancelDeletionMock(...a),
    setCommissionRate: (...a: unknown[]) => setCommissionMock(...a),
    getDeletionImpact: (...a: unknown[]) => impactMock(...a), deleteUser: (...a: unknown[]) => deleteUserMock(...a),
  },
}))
const overviewMock = vi.fn()
const sectionMock = vi.fn()
vi.mock('@/features/user-profile/services/userProfileService', () => ({
  userProfileService: {
    overview: (...a: unknown[]) => overviewMock(...a),
    section: (...a: unknown[]) => sectionMock(...a),
  },
}))
vi.mock('@/features/wallet/components/UserWalletTab.vue', () => ({
  default: { props: ['userId'], template: '<div data-test="wallet-tab">{{ userId }}</div>' },
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
    navigateToMock.mockReset(); replaceMock.mockReset(); getMock.mockReset(); overviewMock.mockReset(); sectionMock.mockReset(); getKycMock.mockReset()
    suspendMock.mockReset(); cancelDeletionMock.mockReset(); setCommissionMock.mockReset(); impactMock.mockReset(); deleteUserMock.mockReset()
    sectionMock.mockResolvedValue({ content: [], totalPages: 0, number: 0, totalElements: 0 })
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

  it('les onglets de listes sont branchés avec l’identifiant du compte', async () => {
    let w = await mountPage({ tab: 'parcels' })
    expect(sectionMock.mock.calls.map(c => c[1]).sort()).toEqual(['parcels', 'requests', 'trips'])
    expect(sectionMock.mock.calls.every(c => c[0] === ID)).toBe(true)
    expect(w.get('[data-test="tab-content-parcels"]').find('[data-test="section-trips"]').exists()).toBe(true)
    sectionMock.mockClear()
    w = await mountPage({ tab: 'money' })
    expect(w.get('[data-test="tab-content-money"]').get('[data-test="wallet-tab"]').text()).toBe(ID)
    expect(sectionMock).toHaveBeenCalledWith(ID, 'payments', 0, 20, undefined)
    sectionMock.mockClear()
    w = await mountPage({ tab: 'incidents' })
    expect(w.get('[data-test="tab-content-incidents"]').find('[data-test="section-reports-received"]').exists()).toBe(true)
    expect(sectionMock).toHaveBeenCalledTimes(5)
  })

  it('onglets identité et support : KYC chargé à l’ouverture, journal des gestes', async () => {
    getKycMock.mockResolvedValue({ kycStatus: 'VERIFIED' })
    const id = await mountPage({ tab: 'identity' })
    expect(getKycMock).toHaveBeenCalledWith(ID)
    expect(id.find('[data-test="tab-content-identity"]').exists()).toBe(true)
    sectionMock.mockClear()
    const sup = await mountPage({ tab: 'support' })
    expect(sup.get('[data-test="tab-content-support"]').find('[data-test="section-audit"]').exists()).toBe(true)
    expect(sectionMock).toHaveBeenCalledWith(ID, 'audit', 0, 20, undefined)
  })

  it('une relecture lancée avant une suspension et résolue après ne restaure pas l’ancien statut', async () => {
    getKycMock.mockResolvedValue({ kycStatus: 'VERIFIED' })
    const w = await mountPage({ tab: 'identity' })
    let resolveStale: (_v: unknown) => void = () => {}
    getMock.mockReturnValueOnce(new Promise((r) => { resolveStale = r }))
    w.getComponent({ name: 'UserIdentityTab' }).vm.$emit('refresh')
    await flushPromises()
    suspendMock.mockResolvedValue({ ...USER, status: 'SUSPENDED' })
    await w.get('[data-test="actions-trigger"]').trigger('click')
    await w.get('[data-test="menu-suspend"]').trigger('click')
    await w.get('[data-test="reason"]').setValue('Fraude')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="profile-header"]').text()).toContain('Suspendu')
    resolveStale({ ...USER, status: 'ACTIVE' })
    await flushPromises()
    expect(w.get('[data-test="profile-header"]').text()).toContain('Suspendu')
    expect(w.find('[data-test="alert-suspended"]').exists()).toBe(true)
  })

  it('synthèse sans aucune clé facultative (JSON NON_NULL) : la fiche s’affiche et masque les cartes absentes', async () => {
    overviewMock.mockResolvedValue({ kpis: { parcelsInProgress: 0 }, inProgress: undefined, timeline: undefined })
    const w = await mountPage()
    expect(w.get('[data-test="profile-name"]').text()).toBe('Awa Diallo')
    expect(w.get('[data-test="kpi-parcels"]').text()).toContain('0')
    for (const k of ['trips', 'held', 'disputes', 'reports', 'rating']) expect(w.find(`[data-test="kpi-${k}"]`).exists()).toBe(false)
    expect(w.find('[data-test="in-progress-card"]').exists()).toBe(false)
    expect(w.find('[data-test="timeline-card"]').exists()).toBe(false)
  })

  it('refresh de l’onglet identité : détail relu en silence, onglet non remonté', async () => {
    getKycMock.mockResolvedValue({ kycStatus: 'VERIFIED' })
    const w = await mountPage({ tab: 'identity' })
    const panel = w.get('[data-test="tab-content-identity"]').element
    expect(getMock).toHaveBeenCalledTimes(1)
    getMock.mockResolvedValue({ ...USER, firstName: 'Awa2' })
    w.getComponent({ name: 'UserIdentityTab' }).vm.$emit('refresh')
    await flushPromises()
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(w.get('[data-test="tab-content-identity"]').element).toBe(panel)
    expect(getKycMock).toHaveBeenCalledTimes(1)
    expect(w.get('[data-test="profile-name"]').text()).toContain('Awa2')
    getMock.mockRejectedValue({ statusCode: 404 })
    w.getComponent({ name: 'UserIdentityTab' }).vm.$emit('refresh')
    await flushPromises()
    expect(w.find('[data-test="user-not-found"]').exists()).toBe(false)
    expect(w.get('[data-test="profile-name"]').text()).toContain('Awa2')
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

  it('panneaux d’onglet : simples sections reliées à leur bouton, sans rôle tabpanel', async () => {
    const w = await mountPage({ tab: 'money' })
    const panel = w.get('[data-test="tab-content-money"]')
    expect(panel.element.tagName).toBe('SECTION')
    expect(panel.attributes('role')).toBeUndefined()
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

  describe('actions du compte', () => {
    const openMenu = async (w: Awaited<ReturnType<typeof mountPage>>) => { await w.get('[data-test="actions-trigger"]').trigger('click'); await flushPromises() }

    it('le menu est dans l’en-tête et suspendre met la fiche à jour sur place', async () => {
      suspendMock.mockResolvedValue({ ...USER, status: 'SUSPENDED' })
      const w = await mountPage()
      expect(w.get('[data-test="profile-actions-slot"]').find('[data-test="actions-trigger"]').exists()).toBe(true)
      await openMenu(w)
      await w.get('[data-test="menu-suspend"]').trigger('click')
      await w.get('[data-test="reason"]').setValue('Fraude')
      await w.get('[data-test="confirm"]').trigger('click')
      await flushPromises()
      expect(suspendMock).toHaveBeenCalledWith(ID, 'Fraude')
      expect(getMock).toHaveBeenCalledTimes(1)
      expect(w.get('[data-test="profile-header"]').text()).toContain('Suspendu')
      expect(w.find('[data-test="account-action-error"]').exists()).toBe(false)
    })

    it('échec : message dans un bandeau d’alerte, menu de nouveau utilisable', async () => {
      suspendMock.mockRejectedValue({ data: { detail: 'Compte déjà traité' } })
      const w = await mountPage()
      await openMenu(w)
      await w.get('[data-test="menu-suspend"]').trigger('click')
      await w.get('[data-test="reason"]').setValue('Fraude')
      await w.get('[data-test="confirm"]').trigger('click')
      await flushPromises()
      const alert = w.get('[data-test="account-action-error"]')
      expect(alert.attributes('role')).toBe('alert')
      expect(alert.text()).toBe('Compte déjà traité')
      await openMenu(w)
      expect(w.get('[data-test="menu-ban"]').attributes('disabled')).toBeUndefined()
    })

    it('pendant le geste : éléments du menu désactivés', async () => {
      const d = Promise.withResolvers<unknown>()
      suspendMock.mockReturnValue(d.promise)
      const w = await mountPage()
      await openMenu(w)
      await w.get('[data-test="menu-suspend"]').trigger('click')
      await w.get('[data-test="reason"]').setValue('Fraude')
      await w.get('[data-test="confirm"]').trigger('click')
      await openMenu(w)
      expect(w.get('[data-test="menu-ban"]').attributes('aria-disabled')).toBe('true')
      d.resolve({ ...USER, status: 'SUSPENDED' }); await flushPromises()
    })

    it('SUPPORT : « Écrire » seulement, pas d’onglet Gestion', async () => {
      const w = await mountPage({}, ID, 'SUPPORT')
      await openMenu(w)
      expect(w.findAll('[role="menuitem"]').map(i => i.attributes('data-test'))).toEqual(['menu-writeSupport'])
      expect(w.find('[data-test="tab-manage"]').exists()).toBe(false)
    })

    it('geste terminé après un changement de compte : la fiche du nouveau compte n’est pas écrasée', async () => {
      const { reactive } = await import('vue')
      seedAuth('ADMIN')
      const route = reactive({ params: { id: ID } as Record<string, string>, query: {} as Record<string, string> })
      vi.stubGlobal('useRoute', () => route)
      vi.resetModules()
      const mod = await import('@/pages/users/[id].vue')
      const w = mount(mod.default, { attachTo: document.body, global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
      await flushPromises()
      const d = Promise.withResolvers<unknown>()
      suspendMock.mockReturnValue(d.promise)
      await w.get('[data-test="actions-trigger"]').trigger('click')
      await w.get('[data-test="menu-suspend"]').trigger('click')
      await w.get('[data-test="reason"]').setValue('Fraude')
      await w.get('[data-test="confirm"]').trigger('click')
      const OTHER = '9a9a9a9a-2222-4333-8444-aaaaaaaaaaaa'
      getMock.mockResolvedValue({ ...USER, id: OTHER, firstName: 'Moussa', lastName: 'Kane' })
      route.params.id = OTHER
      await flushPromises()
      d.resolve({ ...USER, status: 'SUSPENDED' }); await flushPromises()
      expect(w.get('[data-test="profile-name"]').text()).toBe('Moussa Kane')
      expect(w.get('[data-test="profile-header"]').text()).not.toContain('Suspendu')
      w.unmount()
    })
  })

  describe('bandeaux d’en-tête', () => {
    const PD = { ...USER, status: 'PENDING_DELETION', deletionScheduledFor: '2026-11-15T12:00:00Z' }

    it('suppression demandée : annuler avec motif remplace la fiche', async () => {
      getMock.mockResolvedValue(PD)
      cancelDeletionMock.mockResolvedValue({ ...USER, status: 'ACTIVE' })
      const w = await mountPage()
      expect(w.get('[data-test="user-pending-deletion"]').text()).toContain('Suppression prévue le')
      await w.get('[data-test="action-cancel-deletion"]').trigger('click')
      await w.get('[data-test="restore-reason"]').setValue('Demande confirmée par téléphone')
      await w.get('[data-test="restore-confirm"]').trigger('click')
      await flushPromises()
      expect(cancelDeletionMock).toHaveBeenCalledWith(ID, 'Demande confirmée par téléphone')
      expect(w.find('[data-test="user-pending-deletion"]').exists()).toBe(false)
      expect(w.find('[data-test="restore-dialog"]').exists()).toBe(false)
    })

    it('422 : le dialogue reste ouvert avec le message', async () => {
      getMock.mockResolvedValue(PD)
      cancelDeletionMock.mockRejectedValue({ statusCode: 422, data: { violations: { reason: 'Motif trop court' } } })
      const w = await mountPage()
      await w.get('[data-test="action-cancel-deletion"]').trigger('click')
      await w.get('[data-test="restore-reason"]').setValue('Demande confirmée par téléphone')
      await w.get('[data-test="restore-confirm"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="restore-error"]').text()).toBe('Motif trop court')
    })

    it('endpoint absent : texte à la place du bouton, dialogue fermé', async () => {
      getMock.mockResolvedValue(PD)
      cancelDeletionMock.mockRejectedValue({ statusCode: 404 })
      const w = await mountPage()
      await w.get('[data-test="action-cancel-deletion"]').trigger('click')
      await w.get('[data-test="restore-reason"]').setValue('Demande confirmée par téléphone')
      await w.get('[data-test="restore-confirm"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="restore-dialog"]').exists()).toBe(false)
      expect(w.find('[data-test="action-cancel-deletion"]').exists()).toBe(false)
      expect(w.get('[data-test="cancel-deletion-unavailable"]').exists()).toBe(true)
    })

    it('versements retenus : bandeau et lien selon PAYMENT_VIEW', async () => {
      getMock.mockResolvedValue({ ...USER, status: 'BANNED', payoutsHeldReasons: ['BANNED'], heldPaymentsCount: 2 })
      let w = await mountPage()
      expect(w.get('[data-test="user-payouts-held"]').attributes('role')).toBe('status')
      expect(w.get('[data-test="user-payouts-held-link"]').attributes('href')).toBe('/transactions?held=true')
      seedAuth('ADMIN', { PAYMENT_VIEW: false })
      vi.resetModules()
      const mod = await import('@/pages/users/[id].vue')
      w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
      await flushPromises()
      expect(w.find('[data-test="user-payouts-held"]').exists()).toBe(true)
      expect(w.find('[data-test="user-payouts-held-link"]').exists()).toBe(false)
    })
  })

  describe('onglet Gestion', () => {
    it('commission : 8 donne 0,08 et la fiche reflète la réponse', async () => {
      setCommissionMock.mockResolvedValue({ ...USER, commissionRateOverride: 0.08 })
      const w = await mountPage({ tab: 'manage' })
      await w.get('[data-test="commission-input"]').setValue('8')
      await w.get('[data-test="commission-apply"]').trigger('click')
      await w.get('[data-test="confirm"]').trigger('click')
      await flushPromises()
      expect(setCommissionMock).toHaveBeenCalledWith(ID, 0.08)
      expect(w.get('[data-test="commission-state"]').text()).toContain('8.0 %')
    })

    it('échec d’un geste depuis Gestion : une seule alerte, dans l’onglet', async () => {
      setCommissionMock.mockRejectedValue({ data: { detail: 'Taux refusé' } })
      const w = await mountPage({ tab: 'manage' })
      await w.get('[data-test="commission-input"]').setValue('8')
      await w.get('[data-test="commission-apply"]').trigger('click')
      await w.get('[data-test="confirm"]').trigger('click')
      await flushPromises()
      expect(w.get('[data-test="manage-error"]').text()).toBe('Taux refusé')
      expect(w.find('[data-test="account-action-error"]').exists()).toBe(false)
      expect(w.findAll('[role="alert"]').filter(a => a.text() === 'Taux refusé')).toHaveLength(1)
    })

    it('suppression : analyse d’impact, confirmation, redirection vers /users', async () => {
      impactMock.mockResolvedValue({ blocked: false, findings: [] })
      deleteUserMock.mockResolvedValue(undefined)
      const w = await mountPage({ tab: 'manage' })
      await w.get('[data-test="action-delete"]').trigger('click')
      await flushPromises()
      expect(impactMock).toHaveBeenCalledWith(ID)
      w.getComponent({ name: 'UserDeletionDialog' }).vm.$emit('confirm', 'FRAUD', 'Fraude')
      await flushPromises()
      expect(deleteUserMock).toHaveBeenCalledWith(ID, 'FRAUD', 'Fraude')
      expect(navigateToMock).toHaveBeenCalledWith('/users', { replace: true })
    })

    it('GP Pro relu : le détail est rechargé en silence', async () => {
      const w = await mountPage({ tab: 'manage' })
      getMock.mockResolvedValue({ ...USER, gpPro: false })
      w.getComponent({ name: 'UserGpProSection' }).vm.$emit('changed')
      await flushPromises()
      expect(getMock).toHaveBeenCalledTimes(2)
    })
  })
})
