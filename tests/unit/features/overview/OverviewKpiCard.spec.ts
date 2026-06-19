import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewKpiCard from '@/features/overview/components/OverviewKpiCard.vue'

describe('OverviewKpiCard', () => {
  it('renders label, value, sublabel with data-test', () => {
    const w = mount(OverviewKpiCard, { props: { id: 'users-total', label: 'Utilisateurs', value: '120', subLabel: '100 actifs' } })
    expect(w.find('[data-test="kpi-users-total"]').exists()).toBe(true)
    expect(w.text()).toContain('Utilisateurs')
    expect(w.text()).toContain('120')
    expect(w.text()).toContain('100 actifs')
  })
})
