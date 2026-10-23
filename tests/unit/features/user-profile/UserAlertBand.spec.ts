import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserAlertBand from '@/features/user-profile/components/UserAlertBand.vue'

describe('UserAlertBand', () => {
  it('absente sans alerte', () => {
    const w = mount(UserAlertBand, { props: { alerts: [] } })
    expect(w.find('[role="status"]').exists()).toBe(true) // conteneur persistant
    expect(w.find('[data-test="alert-band-content"]').exists()).toBe(false)
  })
  it('liste les alertes dans une zone role=status', () => {
    const w = mount(UserAlertBand, { props: { alerts: [{ id: 'a', text: '1 litige ouvert' }, { id: 'b', text: 'Compte suspendu' }] } })
    const band = w.find('[role="status"]')
    expect(band.exists()).toBe(true)
    expect(band.text()).toContain('À surveiller')
    expect(band.text()).toContain('1 litige ouvert')
    expect(band.text()).toContain('Compte suspendu')
  })
})
