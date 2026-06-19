import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewQueueCard from '@/features/overview/components/OverviewQueueCard.vue'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to"><slot /></a>', props: ['to'] }

describe('OverviewQueueCard', () => {
  it('renders label + count and links to href', () => {
    const w = mount(OverviewQueueCard, {
      props: { card: { id: 'disputes', label: 'Litiges ouverts', count: 2, tone: 'danger', href: '/incidents' } },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(w.find('[data-test="queue-disputes"]').exists()).toBe(true)
    expect(w.text()).toContain('Litiges ouverts')
    expect(w.text()).toContain('2')
    expect(w.find('a').attributes('href')).toBe('/incidents')
  })
})
