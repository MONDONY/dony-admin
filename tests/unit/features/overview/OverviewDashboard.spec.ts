import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const fetchOverview = vi.fn()
vi.mock('@/features/overview/composables/useOverview', async () => {
  const { ref } = await import('vue')
  return {
    useOverview: () => ({
      data: ref({}),
      isLoading: ref(false),
      error: ref(null),
      kpis: ref([{ id: 'users-total', label: 'Utilisateurs', value: '120' }]),
      queues: ref([{ id: 'disputes', label: 'Litiges ouverts', count: 2, tone: 'danger', href: '/incidents' }]),
      fetchOverview,
    }),
  }
})

import OverviewDashboard from '@/features/overview/components/OverviewDashboard.vue'
const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }

describe('OverviewDashboard', () => {
  it('fetches on mount and renders KPI + queue cards', async () => {
    const w = mount(OverviewDashboard, { global: { stubs: { NuxtLink: NuxtLinkStub } } })
    await flushPromises()
    expect(fetchOverview).toHaveBeenCalled()
    expect(w.find('[data-test="kpi-users-total"]').exists()).toBe(true)
    expect(w.find('[data-test="queue-disputes"]').exists()).toBe(true)
  })
})
