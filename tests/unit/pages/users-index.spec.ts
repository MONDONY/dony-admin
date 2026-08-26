/**
 * Constat 1 — la page users/index.vue doit lire le paramètre ?query= de l'URL
 * au montage et l'appliquer comme filtre de recherche.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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
