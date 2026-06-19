import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/ui/StatusBadge.vue'

describe('StatusBadge', () => {
  it('renders the label', () => {
    expect(mount(StatusBadge, { props: { label: 'Actif', tone: 'success' } }).text()).toContain('Actif')
  })
  it('applies a danger tone class', () => {
    const w = mount(StatusBadge, { props: { label: 'Banni', tone: 'danger' } })
    expect(w.html()).toMatch(/danger/)
  })
})
