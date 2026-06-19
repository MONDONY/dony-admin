/**
 * Smoke tests for placeholder pages (no real logic — just definePageMeta + template).
 * Mounting them is enough to bring their lines/statements to 100%.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// Nuxt auto-imports used in pages — stub them globally
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useRoute', () => ({ meta: {} }))

const NuxtLinkStub = { name: 'NuxtLink', template: '<a><slot /></a>', props: ['to'] }

describe('placeholder pages', () => {
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
  ]

  for (const importFn of stubPages) {
    it(`mounts ${importFn.toString().match(/'([^']+)'/)?.[1] ?? 'page'}`, async () => {
      const mod = await importFn()
      const wrapper = mount(mod.default, { global: { stubs: { NuxtLink: NuxtLinkStub } } })
      expect(wrapper.exists()).toBe(true)
    })
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
