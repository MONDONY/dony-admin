/**
 * Smoke tests for all pages (mounts without crash).
 * Real logic tested in feature-level unit/e2e tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

// Nuxt auto-imports
vi.stubGlobal('definePageMeta', vi.fn())
// Le stub inclut `query` (objet vide) pour simuler une navigation sans paramètres d'URL.
// Sans cette propriété, les pages qui lisent `route.query?.xxx` reçoivent `undefined`
// et peuvent lever une rejection non gérée au montage.
vi.stubGlobal('useRoute', () => ({ meta: {}, query: {} }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: '', firebaseApiKey: '' } }))
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))

// Mock useApi so composables don't make real HTTP calls
vi.mock('@/composables/useApi', () => ({
  useApi: () => vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }),
}))

const NuxtLinkStub = { name: 'NuxtLink', template: '<a><slot /></a>', props: ['to'] }

describe('placeholder pages', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const stubPages = [
    () => import('@/pages/index.vue'),
    () => import('@/pages/alertes/index.vue'),
    () => import('@/pages/audit/index.vue'),
    () => import('@/pages/colis/index.vue'),
    () => import('@/pages/exports/index.vue'),
    () => import('@/pages/incidents/index.vue'),
    () => import('@/pages/moderation/index.vue'),
    () => import('@/pages/promo/index.vue'),
    () => import('@/pages/signalements/index.vue'),
    () => import('@/pages/transactions/index.vue'),
    () => import('@/pages/users/index.vue'),
    () => import('@/pages/users/rgpd.vue'),
  ]

  for (const importFn of stubPages) {
    it(`mounts ${importFn.toString().match(/'([^']+)'/)?.[1] ?? 'page'}`, async () => {
      const mod = await importFn()
      const wrapper = mount(mod.default, {
        global: {
          stubs: {
            NuxtLink: NuxtLinkStub,
            // Stub all heavy child components to avoid deep import chains
            UserFilters: true, UserTable: true, UserDetailPanel: true, GdprRequestsTable: true,
            AlertsTable: true, TransactionsTable: true, BidsTable: true,
            AnnouncementsTable: true, DisputesTable: true, CancellationsTable: true,
            ModerationTable: true, PromoTable: true, AuditTable: true,
            ExportsPanel: true, SignalementsTable: true, RatingsTable: true,
            PaginationControls: true, ConfirmActionDialog: true,
            StatusBadge: true, GuaranteeFundForm: true, BidDetailPanel: true,
            BidTimeline: true, PaymentDetailPanel: true, ChargebacksTable: true,
            OverviewDashboard: true, KpiCard: true, QueueCard: true,
          },
        },
      })
      expect(wrapper.exists()).toBe(true)
    }, 15000)
  }
})

describe('denied page', () => {
  it('renders the access denied message', async () => {
    const mod = await import('@/pages/denied.vue')
    const wrapper = mount(mod.default, {
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(wrapper.text()).toContain('Accès refusé')
  })
})

describe('app.vue', () => {
  it('renders NuxtLayout and NuxtPage', async () => {
    const mod = await import('@/app.vue')
    const wrapper = mount(mod.default, {
      global: {
        stubs: {
          NuxtLayout: { name: 'NuxtLayout', template: '<div class="layout"><slot /></div>' },
          NuxtPage: { name: 'NuxtPage', template: '<div class="page" />' },
        },
      },
    })
    expect(wrapper.find('.layout').exists()).toBe(true)
    expect(wrapper.find('.page').exists()).toBe(true)
  })
})
