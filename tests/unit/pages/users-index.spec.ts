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
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: '', firebaseApiKey: '' } }))

// Mock du service — on veut observer quels filtres sont transmis
const listMock = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: {
    list: (...a: unknown[]) => listMock(...a),
    getUserDetail: vi.fn().mockResolvedValue(null),
    getDeletionImpact: vi.fn().mockResolvedValue(null),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    getKyc: vi.fn().mockResolvedValue(null),
    resetKyc: vi.fn().mockResolvedValue(undefined),
  },
}))

const NuxtLinkStub = { name: 'NuxtLink', template: '<a><slot /></a>', props: ['to', 'target', 'rel'] }

async function mountUsersPage(queryParam?: string) {
  // On contrôle useRoute() pour simuler le paramètre d'URL
  vi.stubGlobal('useRoute', () => ({
    meta: { middleware: 'admin-only', permission: 'USER_VIEW' },
    query: queryParam ? { query: queryParam } : {},
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
vi.mock('@/features/users/composables/useUserDetail', () => ({
  useUserDetail: () => ({
    user: userRef,
    isLoading: ref(false),
    error: ref(null),
    busy: ref(false),
    open: vi.fn(),
    close: vi.fn(),
    suspend: vi.fn(),
    ban: vi.fn(),
    unsuspend: vi.fn(),
    suspendPublishing: vi.fn(),
    liftPublishing: vi.fn(),
    setCommissionRate: vi.fn(),
    muteMessaging: vi.fn(),
    unmuteMessaging: vi.fn(),
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
