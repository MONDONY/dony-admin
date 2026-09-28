import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const countersMock = vi.fn()
vi.mock('@/features/notifications/services/notificationsService', () => ({
  notificationsService: {
    counters: (...a: unknown[]) => countersMock(...a),
    feed: vi.fn(),
    markSeen: vi.fn(),
  },
}))

import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { POLL_INTERVAL_MS } from '@/stores/notifications'
import { makeAdmin } from '../helpers/auth'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }
const ClientOnlyStub = { name: 'ClientOnly', template: '<div><slot /></div>' }

let wrapper: VueWrapper | null = null
async function mountSidebar() {
  wrapper = mount(AppSidebar, { global: { stubs: { NuxtLink: NuxtLinkStub, ClientOnly: ClientOnlyStub } } })
  await flushPromises()
  return wrapper
}
const badgeOf = (href: string) => wrapper!.find(`nav a[href="${href}"] [data-test="badge"]`)

describe('AppSidebar : compteurs du menu', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    useAuthStore().setSession('t', makeAdmin('SUPER_ADMIN'))
    countersMock.mockReset()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.useRealTimers()
  })

  it('un badge à droite de chaque entrée concernée', async () => {
    countersMock.mockResolvedValue({
      counts: { reports: 2, support: 5, incidents: 1, kyc: 3, heldPayouts: 1, walletRefunds: 2, gdpr: 4, alerts: 6 },
      unreadCount: 0,
    })
    await mountSidebar()
    expect(badgeOf('/signalements').text()).toContain('2')
    expect(badgeOf('/support').text()).toContain('5')
    expect(badgeOf('/incidents').text()).toContain('1')
    expect(badgeOf('/kyc').text()).toContain('3')
    expect(badgeOf('/transactions').text()).toContain('3')
    expect(badgeOf('/users/rgpd').text()).toContain('4')
    expect(badgeOf('/alertes').text()).toContain('6')
    expect(badgeOf('/users').exists()).toBe(false)
  })

  it('rouge pour Alertes et versements retenus, neutre sinon', async () => {
    countersMock.mockResolvedValue({ counts: { alerts: 1, heldPayouts: 1, reports: 1 }, unreadCount: 0 })
    await mountSidebar()
    expect(badgeOf('/alertes').attributes('data-tone')).toBe('danger')
    expect(badgeOf('/transactions').attributes('data-tone')).toBe('danger')
    expect(badgeOf('/signalements').attributes('data-tone')).toBe('neutral')
  })

  it('masqué à 0 ou si la clé est absente (pas de permission)', async () => {
    countersMock.mockResolvedValue({ counts: { reports: 0 }, unreadCount: 0 })
    await mountSidebar()
    expect(wrapper!.findAll('[data-test="badge"]')).toHaveLength(0)
  })

  it('« 99+ » au-delà de 99', async () => {
    countersMock.mockResolvedValue({ counts: { support: 240 }, unreadCount: 0 })
    await mountSidebar()
    expect(badgeOf('/support').text()).toContain('99+')
  })

  it('se met à jour au rafraîchissement suivant', async () => {
    countersMock.mockResolvedValue({ counts: { reports: 1 }, unreadCount: 0 })
    await mountSidebar()
    countersMock.mockResolvedValue({ counts: { reports: 4 }, unreadCount: 0 })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    await flushPromises()
    expect(badgeOf('/signalements').text()).toContain('4')
  })

  it('ancien back : aucun badge', async () => {
    countersMock.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404 }))
    await mountSidebar()
    expect(wrapper!.findAll('[data-test="badge"]')).toHaveLength(0)
  })
})
