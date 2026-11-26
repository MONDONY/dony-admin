import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/features/notifications/services/notificationsService', () => ({
  notificationsService: {
    counters: vi.fn().mockResolvedValue({ counts: { alerts: 3, support: 120 }, unreadCount: 0 }),
    feed: vi.fn(), markSeen: vi.fn(), markRead: vi.fn(),
  },
}))
const headMock = vi.fn()
vi.stubGlobal('useHead', headMock)
vi.stubGlobal('useRuntimeConfig', () => ({ app: { baseURL: '/siragbe/' }, public: {} }))
const routeState = { path: '/m/support', meta: { pageTitle: 'Support' } }
vi.stubGlobal('useRoute', () => routeState)

import MobileLayout from '@/layouts/mobile.vue'
import { seedAuth } from '../../../helpers/auth'

const NuxtLink = {
  name: 'NuxtLink', props: ['to'],
  template: '<a :href="to" v-bind="$attrs"><slot /></a>',
}
const mountLayout = () => mount(MobileLayout, {
  global: { stubs: { NuxtLink } },
  slots: { default: '<p class="page">Contenu</p>' },
})

describe('mobile layout', () => {
  beforeEach(() => {
    headMock.mockClear()
    routeState.path = '/m/support'
  })

  it('renders only the permitted tabs', async () => {
    seedAuth('ADMIN', { METRICS_VIEW: false, NOTIFICATION_SEND: false })
    const w = mountLayout()
    await flushPromises()
    const labels = w.findAll('[data-test="mobile-tab"]').map(t => t.text().replace(/\d+\+?$/, '').trim())
    expect(labels).toEqual(['Alertes', 'Support', 'Messages'])
    expect(w.find('.page').exists()).toBe(true)
  })

  it('marks the active tab', async () => {
    seedAuth('SUPER_ADMIN')
    const w = mountLayout()
    await flushPromises()
    const active = w.findAll('[data-test="mobile-tab"][aria-current="page"]')
    expect(active).toHaveLength(1)
    expect(active[0]!.attributes('href')).toBe('/m/support')
  })

  it('shows pastilles from the notification counters, capped at 99+', async () => {
    seedAuth('SUPER_ADMIN')
    const w = mountLayout()
    await flushPromises()
    expect(w.find('[data-tab="alertes"] [data-test="mobile-badge"]').text()).toBe('3')
    expect(w.find('[data-tab="support"] [data-test="mobile-badge"]').text()).toBe('99+')
    expect(w.find('[data-tab="messages"] [data-test="mobile-badge"]').exists()).toBe(false)
  })

  it('declares manifest, theme-color and iOS install metas', () => {
    seedAuth('SUPER_ADMIN')
    mountLayout()
    const head = headMock.mock.calls[0]![0] as { link: Array<Record<string, string>>, meta: Array<Record<string, string>> }
    expect(head.link).toContainEqual({ rel: 'manifest', href: '/siragbe/m/manifest.webmanifest' })
    expect(head.link.some(l => l.rel === 'apple-touch-icon' && l.href === '/siragbe/m/icon-192.png')).toBe(true)
    expect(head.meta.some(m => m.name === 'theme-color')).toBe(true)
    expect(head.meta).toContainEqual({ name: 'apple-mobile-web-app-capable', content: 'yes' })
  })
})
