import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import { defineComponent, h, type Component } from 'vue'

/**
 * Le lien de la tuile « Alertes ouvertes » avec un VRAI composant de lien, sans stub global. Comme le
 * chargeur de composants de Nuxt, `resolveComponent('NuxtLink')` (gabarit compilé ou script) rend le
 * composant ; un nom passé en chaîne à `<component :is>` ne l'est pas et devient une balise
 * <nuxtlink> inerte (bug d'origine). Le composant est un RouterLink de vue-router, ce que NuxtLink rend
 * pour une route interne.
 */
const link = vi.hoisted(() => ({ component: null as unknown }))
vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal<typeof import('vue')>()
  return {
    ...vue,
    resolveComponent: (name: string, ...rest: [boolean?]) => (name === 'NuxtLink' && link.component ? link.component : vue.resolveComponent(name, ...rest)),
  }
})
vi.stubGlobal('definePageMeta', vi.fn())
const svc = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/features/overview/services/overviewService', () => ({ overviewService: svc }))

import Page from '@/pages/m/ensemble.vue'
import { seedAuth } from '../../helpers/auth'

link.component = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: [String, Object], required: true } },
  setup: (props, { slots }) => () => h(RouterLink, { to: props.to }, slots),
}) as Component

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] })
const overview = {
  bids: { accepted: 1, inTransit: 1 }, queues: { unresolvedAlerts: 3, openDisputes: 0, pendingNoShows: 0, heldPayouts: 0 },
  period: { name: 'D7', signups: 1, deletedAccounts: 0, parcelsCancelled: 0, kycInProgress: 0 },
}

describe('m/ensemble with a real link component (no global NuxtLink stub)', () => {
  it('the "Alertes ouvertes" tile is a working <a href="/m/alertes">, not an inert <nuxtlink>', async () => {
    seedAuth('ADMIN')
    svc.fetch.mockResolvedValue(overview)
    await router.push('/m/ensemble')
    const w = mount(Page, { global: { plugins: [router] } })
    await flushPromises()
    const tile = w.find('[data-test="tile-alerts"]')
    expect(w.html()).not.toContain('<nuxtlink')
    expect(tile.element.tagName).toBe('A')
    expect(tile.attributes('href')).toBe('/m/alertes')
    await tile.trigger('click'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/m/alertes')
  })

  it('without ALERT_VIEW the tile stays a plain block', async () => {
    seedAuth('ADMIN', { ALERT_VIEW: false })
    svc.fetch.mockResolvedValue(overview)
    const w = mount(Page, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.find('[data-test="tile-alerts"]').element.tagName).toBe('DIV')
  })
})
