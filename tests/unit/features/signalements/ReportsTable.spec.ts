import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportsTable from '@/features/signalements/components/ReportsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const reports = [
  {
    id: 'r1', targetType: 'USER', targetId: 'u9', targetLabel: null, reason: 'SCAM_ATTEMPT', description: 'faux profil',
    reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null,
    resolvedAt: null, createdAt: '2026-06-01T10:00:00Z',
  },
]

describe('ReportsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))
  it('renders rows with target + reason + reporter', () => {
    const w = mount(ReportsTable, { props: { reports, loading: false } })
    expect(w.find('[data-test="report-row-r1"]').exists()).toBe(true)
    expect(w.text()).toContain('Tentative d’arnaque')
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

  describe('cible affichée (pas seulement le type)', () => {
    it('affiche le nom résolu de la cible quand le back le fournit', () => {
      const withLabel = [{ ...reports[0], targetLabel: 'Fatou Sy' }]
      const w = mount(ReportsTable, { props: { reports: withLabel, loading: false } })
      expect(w.text()).toContain('Fatou Sy')
    })

    it('retombe sur l’identifiant brut quand le back ne peut pas résoudre la cible '
      + '(ex: BID/MESSAGE/RATING, non batchés)', () => {
      const w = mount(ReportsTable, { props: { reports, loading: false } })
      expect(w.text()).toContain('u9')
    })
  })

  it('affiche le libellé français du motif catalogué, pas la valeur brute', () => {
    const w = mount(ReportsTable, { props: { reports, loading: false } })
    expect(w.text()).not.toContain('SCAM_ATTEMPT')
  })

  describe('permission REPORT_RESOLVE sur le bouton Traiter', () => {
    it('affiche Traiter pour un ADMIN', () => {
      seedAuth('ADMIN')
      const w = mount(ReportsTable, { props: { reports, loading: false } })
      expect(w.find('[data-test="resolve-r1"]').exists()).toBe(true)
    })

    it('masque Traiter pour un rôle sans REPORT_RESOLVE', () => {
      seedAuth('SUPPORT', { REPORT_RESOLVE: false })
      const w = mount(ReportsTable, { props: { reports, loading: false } })
      expect(w.find('[data-test="resolve-r1"]').exists()).toBe(false)
    })
  })
})
