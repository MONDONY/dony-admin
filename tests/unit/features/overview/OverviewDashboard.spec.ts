import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

const fetchOverview = vi.fn()
const isLoading = ref(false)
vi.mock('@/features/overview/composables/useOverview', () => ({
  useOverview: () => ({
    data: ref({}),
    isLoading,
    error: ref(null),
    kpis: ref([{ id: 'users-total', label: 'Utilisateurs', value: '120' }]),
    volumes: ref([{ currency: 'XOF', escrowHeld: '9 900,00 XOF', released: '19 800,00 XOF', refunded: '0,00 XOF', commission: '1 800,00 XOF' }]),
    queues: ref([{ id: 'disputes', label: 'Litiges ouverts', count: 2, tone: 'danger', href: '/incidents' }]),
    fetchOverview,
  }),
}))

import OverviewDashboard from '@/features/overview/components/OverviewDashboard.vue'
const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }

describe('OverviewDashboard', () => {
  it('fetches on mount and renders KPI, per-currency volumes and queue cards', async () => {
    isLoading.value = false
    const w = mount(OverviewDashboard, { global: { stubs: { NuxtLink: NuxtLinkStub } } })
    await flushPromises()
    expect(fetchOverview).toHaveBeenCalled()
    expect(w.find('[data-test="kpi-users-total"]').exists()).toBe(true)
    expect(w.find('[data-test="volume-row-XOF"]').text()).toContain('19 800,00 XOF')
    expect(w.find('[data-test="queue-disputes"]').exists()).toBe(true)
  })

  it('hides the volumes table while loading', async () => {
    isLoading.value = true
    const w = mount(OverviewDashboard, { global: { stubs: { NuxtLink: NuxtLinkStub } } })
    await flushPromises()
    expect(w.find('[data-test="volume-row-XOF"]').exists()).toBe(false)
    expect(w.text()).toContain('Chargement')
    isLoading.value = false
  })
})
