import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AuditTable from '@/features/audit/components/AuditTable.vue'

const entries = [
  {
    id: 'e1', action: 'USER_SUSPENDED', entityType: 'USER', entityId: 'u9',
    actorId: 'a1', actorName: 'Admin Dony', ipAddress: '10.0.0.1',
    payload: { reason: 'fraude' }, createdAt: '2026-06-01T10:00:00Z',
  },
]

describe('AuditTable', () => {
  it('renders rows with action + entity + actor', () => {
    const w = mount(AuditTable, { props: { entries, loading: false } })
    expect(w.find('[data-test="audit-row-e1"]').exists()).toBe(true)
    expect(w.text()).toContain('USER_SUSPENDED')
    expect(w.text()).toContain('Admin Dony')
  })

  it('toggles the payload viewer', async () => {
    const w = mount(AuditTable, { props: { entries, loading: false } })
    expect(w.find('[data-test="payload-e1"]').exists()).toBe(false)
    await w.find('[data-test="toggle-e1"]').trigger('click')
    expect(w.find('[data-test="payload-e1"]').exists()).toBe(true)
    expect(w.find('[data-test="payload-e1"]').text()).toContain('fraude')
  })

  it('hides the payload toggle when there is no payload', () => {
    const noPayload = [{ ...entries[0], payload: null }]
    const w = mount(AuditTable, { props: { entries: noPayload, loading: false } })
    expect(w.find('[data-test="toggle-e1"]').exists()).toBe(false)
  })

  it('empty state', () => {
    expect(mount(AuditTable, { props: { entries: [], loading: false } }).text()).toMatch(/Aucune entrée/i)
  })
})
