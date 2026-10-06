import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AlertsTable from '@/features/alerts/components/AlertsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const alerts = [
  { id: 'a1', type: 'ESCROW_J48_TIMEOUT', severity: 'CRITICAL', payload: { bidId: 'b1' }, resolved: false, resolvedAt: null, createdAt: '2026-06-01T10:00:00Z' },
  { id: 'a2', type: 'STRIPE_REFUND_FAILED', severity: 'WARN', payload: {}, resolved: true, resolvedAt: '2026-06-02T10:00:00Z', createdAt: '2026-06-02T09:00:00Z' },
]

describe('AlertsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))
  it('renders a row per alert with type + severity', () => {
    const w = mount(AlertsTable, { props: { alerts, loading: false } })
    expect(w.text()).toContain('ESCROW_J48_TIMEOUT')
    expect(w.text()).toContain('Critique')
  })
  it('shows resolve button only for unresolved alerts and emits resolve', async () => {
    const w = mount(AlertsTable, { props: { alerts, loading: false } })
    expect(w.find('[data-test="resolve-a1"]').exists()).toBe(true)
    expect(w.find('[data-test="resolve-a2"]').exists()).toBe(false)
    await w.find('[data-test="resolve-a1"]').trigger('click')
    expect(w.emitted('resolve')![0]).toEqual(['a1'])
    expect(w.emitted('open')).toBeUndefined()
  })
  it('affiche le titre en clair et le résumé, et ouvre le détail', async () => {
    const w = mount(AlertsTable, { props: { alerts: [{ ...alerts[0], detail: 'Paiement p1 en séquestre' }], loading: false } })
    expect(w.text()).toContain('Paiement en séquestre depuis plus de 48 h')
    expect(w.text()).toContain('Paiement p1 en séquestre')
    await w.find('[data-test="details-a1"]').trigger('click')
    expect(w.emitted('open')![0][0]).toMatchObject({ id: 'a1' })
    expect(w.emitted('resolve')).toBeUndefined()
  })
  it('un clic sur la ligne ouvre le détail', async () => {
    const w = mount(AlertsTable, { props: { alerts, loading: false } })
    await w.find('[data-test="alert-row-a2"]').trigger('click')
    expect(w.emitted('open')![0][0]).toMatchObject({ id: 'a2' })
  })
  it('shows empty state', () => {
    const w = mount(AlertsTable, { props: { alerts: [], loading: false } })
    expect(w.text()).toMatch(/Aucune alerte/i)
  })
})
