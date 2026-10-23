/**
 * Constat 1 — la page users/index.vue doit lire le paramètre ?query= de l'URL
 * au montage et l'appliquer comme filtre de recherche.
 *
 * Constat 2 — les gestionnaires open-kyc et reset-kyc doivent être gardés
 * contre un detail.user.value null pour éviter une erreur silencieuse au clic rapide.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { seedAuth } from '~/tests/helpers/auth'

// Stubs Nuxt globaux
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: '', firebaseApiKey: '' } }))

// Mock du service — on veut observer quels filtres sont transmis
const listMock = vi.fn()
const recetteStatusMock = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: {
    list: (...a: unknown[]) => listMock(...a),
    getRecetteStatus: (...a: unknown[]) => recetteStatusMock(...a),
    getUserDetail: vi.fn().mockResolvedValue(null),
    getDeletionImpact: vi.fn().mockResolvedValue(null),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    getKyc: vi.fn().mockResolvedValue(null),
    resetKyc: vi.fn().mockResolvedValue(undefined),
  },
}))

const NuxtLinkStub = { name: 'NuxtLink', template: '<a><slot /></a>', props: ['to', 'target', 'rel'] }

async function mountUsersPage(queryParam?: string, openParam?: string, extraQuery: Record<string, string> = {}) {
  // On contrôle useRoute() pour simuler le paramètre d'URL
  const query: Record<string, string> = { ...extraQuery }
  if (queryParam) query.query = queryParam
  if (openParam) query.open = openParam
  vi.stubGlobal('useRoute', () => ({
    meta: { middleware: 'admin-only', permission: 'USER_VIEW' },
    query,
  }))

  const mod = await import('@/pages/users/index.vue')
  const wrapper = mount(mod.default, {
    global: {
      stubs: {
        NuxtLink: NuxtLinkStub,
        UserFilters: true,
        UserTable: true,
        UserDetailPanel: true,
        UserDeletionDialog: true,
        PaginationControls: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

// ── Mocks pour les composables KYC / Détail (Constat 2) ──────────────────────
const kycLoadMock = vi.fn()
const kycResetMock = vi.fn()
vi.mock('@/features/users/composables/useUserKyc', () => ({
  useUserKyc: () => ({
    kyc: ref(null),
    isLoading: ref(false),
    error: ref(null),
    busy: ref(false),
    load: kycLoadMock,
    reset: kycResetMock,
  }),
}))

// useUserDetail est mocké localement dans chaque describe selon l'état voulu
// (null ou avec un utilisateur). On doit le mocker ici pour que vi.mock hisse
// la déclaration avant les imports — la valeur de userRef sera mutée dans beforeEach.
const userRef = ref<null | { id: string }>(null)
const detailOpenMock = vi.fn()
vi.mock('@/features/users/composables/useUserDetail', () => ({
  useUserDetail: () => ({
    user: userRef,
    isLoading: ref(false),
    error: ref(null),
    busy: ref(false),
    open: (...a: unknown[]) => detailOpenMock(...a),
    close: vi.fn(),
    suspend: vi.fn(),
    ban: vi.fn(),
    unsuspend: vi.fn(),
    suspendPublishing: vi.fn(),
    liftPublishing: vi.fn(),
    setCommissionRate: vi.fn(),
    muteMessaging: vi.fn(),
    unmuteMessaging: vi.fn(),
    cancelDeletion: vi.fn(),
    cancelDeletionUnavailable: ref(false),
    cancelDeletionReasonError: ref(null),
  }),
}))

// ─────────────────────────────────────────────────────────────────────────────

describe("users/index.vue — lecture du paramètre d'URL", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedAuth('ADMIN')
    listMock.mockReset()
    listMock.mockResolvedValue({
      content: [], totalElements: 0, totalPages: 0, number: 0, size: 20,
    })
    // Réinitialise le module de la page entre chaque test pour repartir
    // d'un composable useUsers frais (sinon l'état filters est partagé).
    vi.resetModules()
  })

  it('appelle usersService.list sans filtre query quand le paramètre est absent', async () => {
    await mountUsersPage()
    expect(listMock).toHaveBeenCalled()
    // Le filtre query doit être vide (chaîne vide, valeur par défaut)
    const [filtersArg] = listMock.mock.calls[0]
    expect(filtersArg.query).toBe('')
  })

  it('applique le paramètre ?query=<uuid> comme filtre de recherche au montage', async () => {
    const uuid = 'a1b2c3d4-0000-0000-0000-000000000000'
    await mountUsersPage(uuid)
    // setSearch doit avoir déclenché un fetchUsers avec le filtre query rempli
    expect(listMock).toHaveBeenCalled()
    const [filtersArg] = listMock.mock.calls[0]
    expect(filtersArg.query).toBe(uuid)
    expect(detailOpenMock).not.toHaveBeenCalled()
  })

  it('retrouve le statut et la recherche de l’URL (?status=SUSPENDED&query=awa) au premier chargement', async () => {
    await mountUsersPage('awa', undefined, { status: 'SUSPENDED' })
    expect(listMock).toHaveBeenCalledTimes(1)
    const [filtersArg] = listMock.mock.calls[0]
    expect(filtersArg.status).toBe('SUSPENDED')
    expect(filtersArg.query).toBe('awa')
  })

  it('ignore un statut inconnu de l’URL au lieu de le transmettre au back', async () => {
    await mountUsersPage(undefined, undefined, { status: 'PIRATE' })
    expect(listMock.mock.calls[0][0].status).toBe('TOUS')
  })

  // Lien depuis l'onglet Portefeuilles des transactions : la liste est filtrée ET la fiche
  // s'ouvre directement, sans second clic sur l'unique ligne.
  it('ouvre directement le tiroir quand ?open=<id>&legacy=1 est fourni', async () => {
    detailOpenMock.mockReset()
    vi.mocked(navigateTo).mockClear()
    const uuid = 'a1b2c3d4-0000-0000-0000-000000000000'
    await mountUsersPage(uuid, uuid, { legacy: '1' })
    expect(navigateTo).not.toHaveBeenCalled()
    expect(listMock.mock.calls[0][0].query).toBe(uuid)
    expect(detailOpenMock).toHaveBeenCalledWith(uuid)
  })

  it('redirige un ancien lien ?open=<id> vers /users/<id> en remplaçant l’entrée', async () => {
    detailOpenMock.mockReset()
    vi.mocked(navigateTo).mockClear()
    const uuid = 'a1b2c3d4-0000-0000-0000-000000000000'
    await mountUsersPage(uuid, uuid)
    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo).toHaveBeenCalledWith(`/users/${uuid}`, { replace: true })
    expect(detailOpenMock).not.toHaveBeenCalled()
  })

  it('un clic sur une ligne ouvre la fiche /users/<id>', async () => {
    vi.mocked(navigateTo).mockClear()
    const w = await mountUsersPage()
    w.findComponent({ name: 'UserTable' }).vm.$emit('select', 'abc')
    await flushPromises()
    expect(navigateTo).toHaveBeenCalledWith('/users/abc')
  })
})

// ── Stub fonctionnel de UserDetailPanel capable d'émettre des événements ──────
const UserDetailPanelStub = {
  name: 'UserDetailPanel',
  props: ['user', 'open', 'error', 'busy', 'kyc', 'kycLoading', 'kycError'],
  emits: ['close', 'suspend', 'ban', 'unsuspend', 'suspend-publishing', 'lift-publishing',
    'set-commission', 'mute-messaging', 'unmute-messaging', 'open-kyc', 'reset-kyc', 'request-delete'],
  template: `
    <div>
      <button data-test="btn-open-kyc"  @click="$emit('open-kyc')" />
      <button data-test="btn-reset-kyc" @click="$emit('reset-kyc', 'test raison')" />
    </div>`,
}

describe("users/index.vue — garde null sur open-kyc et reset-kyc (Constat 2)", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    seedAuth('ADMIN')
    listMock.mockReset()
    listMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    kycLoadMock.mockReset()
    kycResetMock.mockReset()
    vi.resetModules()
  })

  async function mountWithUser(withUser: boolean) {
    userRef.value = withUser ? { id: 'u42' } as any : null

    vi.stubGlobal('useRoute', () => ({
      meta: { middleware: 'admin-only', permission: 'USER_VIEW' },
      query: {},
    }))

    const mod = await import('@/pages/users/index.vue')
    const wrapper = mount(mod.default, {
      global: {
        stubs: {
          NuxtLink: { name: 'NuxtLink', template: '<a><slot /></a>', props: ['to', 'target', 'rel'] },
          UserFilters: true,
          UserTable: true,
          UserDetailPanel: UserDetailPanelStub,
          UserDeletionDialog: true,
          PaginationControls: true,
        },
      },
    })
    await flushPromises()
    return wrapper
  }

  it("open-kyc n'appelle pas kyc.load quand detail.user.value est null", async () => {
    // On force userRef à null après le montage pour simuler un clic avant résolution
    const wrapper = await mountWithUser(true)
    // On force la valeur à null pour simuler l'état dangereux
    userRef.value = null
    await wrapper.find('[data-test="btn-open-kyc"]').trigger('click')
    await flushPromises()
    expect(kycLoadMock).not.toHaveBeenCalled()
  })

  it("open-kyc appelle kyc.load(id) quand detail.user.value est défini", async () => {
    const wrapper = await mountWithUser(true)
    // userRef.value est déjà { id: 'u42' }
    await wrapper.find('[data-test="btn-open-kyc"]').trigger('click')
    await flushPromises()
    expect(kycLoadMock).toHaveBeenCalledWith('u42')
  })

  it("reset-kyc n'appelle pas kyc.reset quand detail.user.value est null", async () => {
    const wrapper = await mountWithUser(true)
    userRef.value = null
    await wrapper.find('[data-test="btn-reset-kyc"]').trigger('click')
    await flushPromises()
    expect(kycResetMock).not.toHaveBeenCalled()
  })
})

describe('users/index.vue — mode recette en masse', () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    recetteStatusMock.mockReset()
    userRef.value = null
    vi.resetModules()
  })

  it('admin sans ADMIN_MANAGE : statut jamais demandé, ni sélection ni filtre', async () => {
    seedAuth('ADMIN')
    const w = await mountUsersPage()
    expect(recetteStatusMock).not.toHaveBeenCalled()
    expect(w.findComponent({ name: 'UserTable' }).props('selectable')).toBe(false)
  })

  it('super-admin en staging : sélection et filtre proposés', async () => {
    seedAuth('SUPER_ADMIN')
    recetteStatusMock.mockResolvedValue({ enabled: true })
    const w = await mountUsersPage()
    expect(recetteStatusMock).toHaveBeenCalled()
    expect(w.findComponent({ name: 'UserTable' }).props('selectable')).toBe(true)
    expect(w.findComponent({ name: 'UserFilters' }).props('showRecette')).toBe(true)
    expect(w.find('[data-test="recette-bulk-bar"]').exists()).toBe(false)
  })

  it('super-admin hors staging : rien', async () => {
    seedAuth('SUPER_ADMIN')
    recetteStatusMock.mockResolvedValue({ enabled: false })
    const w = await mountUsersPage()
    expect(w.findComponent({ name: 'UserTable' }).props('selectable')).toBe(false)
  })

  it('recherche globale : un ?open arrivé après le montage ouvre la fiche, sans rouvrir la même', async () => {
    const { reactive } = await import('vue')
    const route = reactive({ meta: { middleware: 'admin-only', permission: 'USER_VIEW' }, query: {} as Record<string, string> })
    vi.stubGlobal('useRoute', () => route)
    const mod = await import('@/pages/users/index.vue')
    mount(mod.default, { global: { stubs: { NuxtLink: NuxtLinkStub, UserFilters: true, UserTable: true, UserDetailPanel: true, UserDeletionDialog: true, PaginationControls: true } } })
    await flushPromises()
    detailOpenMock.mockClear()
    listMock.mockClear()
    const id = 'f0f0f0f0-0000-4000-8000-000000000001'
    route.query = { query: id, open: id, legacy: '1' }
    await flushPromises()
    expect(listMock.mock.calls.at(-1)?.[0].query).toBe(id)
    expect(detailOpenMock).toHaveBeenCalledWith(id)
    userRef.value = { id }
    detailOpenMock.mockClear()
    route.query = { query: id, open: id, legacy: '1', x: '1' }
    await flushPromises()
    expect(detailOpenMock).not.toHaveBeenCalled()
  })

  it('recherche globale sans legacy : redirige vers la fiche', async () => {
    const { reactive } = await import('vue')
    const route = reactive({ meta: { middleware: 'admin-only', permission: 'USER_VIEW' }, query: {} as Record<string, string> })
    vi.stubGlobal('useRoute', () => route)
    const mod = await import('@/pages/users/index.vue')
    mount(mod.default, { global: { stubs: { NuxtLink: NuxtLinkStub, UserFilters: true, UserTable: true, UserDetailPanel: true, UserDeletionDialog: true, PaginationControls: true } } })
    await flushPromises()
    vi.mocked(navigateTo).mockClear()
    detailOpenMock.mockClear()
    const id = 'f0f0f0f0-0000-4000-8000-000000000002'
    route.query = { query: id, open: id }
    await flushPromises()
    expect(navigateTo).toHaveBeenCalledWith(`/users/${id}`, { replace: true })
    expect(detailOpenMock).not.toHaveBeenCalled()
  })

  it('?open invalide (pas un UUID) : aucune redirection, la liste reste', async () => {
    vi.mocked(navigateTo).mockClear()
    await mountUsersPage(undefined, '../admin/x')
    expect(navigateTo).not.toHaveBeenCalled()
    expect(listMock).toHaveBeenCalled()
  })
})
