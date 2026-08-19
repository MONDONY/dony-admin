import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GdprRequestsTable from '@/features/users/components/GdprRequestsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const REQUESTS = [
  { id: 'u1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr', status: 'PENDING_DELETION' as const, deletionRequestedAt: '2026-07-01T00:00:00', ageDays: 48 },
  { id: 'u2', firstName: 'Awa', lastName: 'Diallo', email: 'awa@x.fr', status: 'PENDING_DELETION' as const, deletionRequestedAt: '2026-08-10T00:00:00', ageDays: 8 },
]

describe('GdprRequestsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('affiche une ligne par demande, avec nom, email et âge', () => {
    const w = mount(GdprRequestsTable, { props: { requests: REQUESTS } })
    expect(w.find('[data-test="row-u1"]').exists()).toBe(true)
    expect(w.text()).toContain('Jean Dupont')
    expect(w.text()).toContain('jean@x.fr')
    expect(w.text()).toContain('48')
  })

  it('affiche un état vide explicite', () => {
    const w = mount(GdprRequestsTable, { props: { requests: [] } })
    expect(w.find('[data-test="gdpr-empty"]').exists()).toBe(true)
  })

  it('émet execute avec la demande visée', async () => {
    const w = mount(GdprRequestsTable, { props: { requests: REQUESTS } })
    await w.find('[data-test="action-gdpr-execute-u1"]').trigger('click')
    expect(w.emitted('execute')![0]).toEqual([REQUESTS[0]])
  })

  it('cache le geste sans la permission USER_GDPR_DELETE', () => {
    seedAuth('SUPPORT')
    const w = mount(GdprRequestsTable, { props: { requests: REQUESTS } })
    expect(w.find('[data-test="action-gdpr-execute-u1"]').exists()).toBe(false)
  })
})
