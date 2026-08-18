import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportsTable from '@/features/signalements/components/ReportsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const reports = [
  {
    id: 'r1', targetType: 'USER', targetId: 'u9', reason: 'FRAUD', description: 'faux profil',
    reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null,
    resolvedAt: null, createdAt: '2026-06-01T10:00:00Z',
  },
]

describe('ReportsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))
  it('renders rows with target + reason + reporter', () => {
    const w = mount(ReportsTable, { props: { reports, loading: false } })
    expect(w.find('[data-test="report-row-r1"]').exists()).toBe(true)
    expect(w.text()).toContain('FRAUD')
    expect(w.text()).toContain('Awa')
  })

  it('emits resolve for open reports', async () => {
    const w = mount(ReportsTable, { props: { reports, loading: false } })
    await w.find('[data-test="resolve-r1"]').trigger('click')
    expect(w.emitted('resolve')![0]).toEqual(['r1'])
  })

  it('hides resolve button when already resolved', () => {
    const resolved = [{ ...reports[0], status: 'RESOLVED' }]
    const w = mount(ReportsTable, { props: { reports: resolved, loading: false } })
    expect(w.find('[data-test="resolve-r1"]').exists()).toBe(false)
  })

  it('empty state', () => {
    expect(mount(ReportsTable, { props: { reports: [], loading: false } }).text()).toMatch(/Aucun signalement/i)
  })

  it('loading state', () => {
    expect(mount(ReportsTable, { props: { reports: [], loading: true } }).text()).toMatch(/Chargement/i)
  })

  it('emits viewPhotos when a report photo is clicked', async () => {
    const withPhotos = [{ ...reports[0], photoUrls: ['https://example.test/a.png'] }]
    const w = mount(ReportsTable, { props: { reports: withPhotos, loading: false } })

    await w.find('[data-test="report-photo-r1-0"]').trigger('click')

    expect(w.emitted('viewPhotos')?.[0]).toEqual([['https://example.test/a.png']])
  })
})
