import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserTable from '@/features/users/components/UserTable.vue'
import BidsTable from '@/features/bids/components/BidsTable.vue'
import DisputesTable from '@/features/incidents/components/DisputesTable.vue'
import AlertQueue from '@/features/alerts/components/AlertQueue.vue'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a><slot /></a>', props: ['to'] }
const cases = [
  ['UserTable', UserTable, { users: [], loading: false }, 'Aucun utilisateur'],
  ['BidsTable', BidsTable, { bids: [], loading: false }, 'Aucun colis'],
  ['DisputesTable', DisputesTable, { disputes: [], loading: false }, 'Aucun litige'],
  ['AlertQueue', AlertQueue, { groups: [], loading: false }, 'Aucune alerte'],
] as const

describe.each(cases)('%s : un échec ne ressemble pas à une liste vide', (_name, component, base, emptyText) => {
  const mountIt = (extra = {}) => {
    seedAuth('ADMIN')
    return mount(component as never, { props: { ...base, ...extra }, global: { stubs: { NuxtLink: NuxtLinkStub } } })
  }

  it('montre l’erreur et « Réessayer » à la place du message vide', async () => {
    const w = mountIt({ error: 'Impossible de charger' })
    expect(w.text()).toContain('Impossible de charger')
    expect(w.text()).not.toContain(emptyText)
    await w.find('[data-test="state-retry"]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('sans erreur, le message vide habituel', () => {
    expect(mountIt().text()).toContain(emptyText)
  })
})
