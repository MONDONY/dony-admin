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

  describe('rapport du scarabée (SCREEN_BUG, cible APP)', () => {
    const screenReport = [{
      ...reports[0], id: 'r2', targetType: 'APP', targetId: null, reason: 'SCREEN_BUG',
      description: 'Le badge passe sous le bouton', screenRoute: '/profile',
    }]

    it('affiche la route de l’écran d’origine et le libellé du motif', () => {
      const w = mount(ReportsTable, { props: { reports: screenReport, loading: false } })
      expect(w.find('[data-test="report-screen-r2"]').text()).toBe('Écran /profile')
      expect(w.text()).toContain('Bug signalé depuis un écran')
      expect(w.text()).toContain('Application')
    })

    it('sans route (ancien rapport), pas de ligne Écran', () => {
      const w = mount(ReportsTable, { props: { reports: [{ ...screenReport[0], screenRoute: null }], loading: false } })
      expect(w.find('[data-test="report-screen-r2"]').exists()).toBe(false)
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

  describe('sélection et suppression (REPORT_DELETE)', () => {
    const two = [reports[0], { ...reports[0], id: 'r2' }]

    it('avec REPORT_DELETE : cases par ligne, case d’en-tête, bouton Supprimer', () => {
      seedAuth('ADMIN')
      const w = mount(ReportsTable, { props: { reports: two, loading: false, selected: ['r1'] } })
      expect(w.find('[data-test="select-page"]').exists()).toBe(true)
      expect((w.find('[data-test="select-r1"]').element as HTMLInputElement).checked).toBe(true)
      expect((w.find('[data-test="select-r2"]').element as HTMLInputElement).checked).toBe(false)
      expect(w.find('[data-test="delete-r1"]').exists()).toBe(true)
    })

    it('émet toggle, togglePage et delete', async () => {
      seedAuth('ADMIN')
      const w = mount(ReportsTable, { props: { reports: two, loading: false, selected: [] } })
      await w.find('[data-test="select-r2"]').trigger('change')
      expect(w.emitted('toggle')![0]).toEqual(['r2'])
      await w.find('[data-test="select-page"]').trigger('change')
      expect(w.emitted('togglePage')).toHaveLength(1)
      await w.find('[data-test="delete-r1"]').trigger('click')
      expect(w.emitted('delete')![0]).toEqual(['r1'])
    })

    it('case d’en-tête cochée quand toute la page l’est', () => {
      seedAuth('ADMIN')
      const w = mount(ReportsTable, { props: { reports: two, loading: false, selected: ['r1', 'r2'] } })
      expect((w.find('[data-test="select-page"]').element as HTMLInputElement).checked).toBe(true)
    })

    it('sans REPORT_DELETE : ni cases ni bouton Supprimer', () => {
      seedAuth('SUPPORT', { REPORT_DELETE: false })
      const w = mount(ReportsTable, { props: { reports: two, loading: false } })
      expect(w.find('[data-test="select-page"]').exists()).toBe(false)
      expect(w.find('[data-test="select-r1"]').exists()).toBe(false)
      expect(w.find('[data-test="delete-r1"]').exists()).toBe(false)
    })
  })
})
