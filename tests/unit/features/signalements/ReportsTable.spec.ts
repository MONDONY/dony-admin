import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportsTable from '@/features/signalements/components/ReportsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }

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

    it.each([
      ['[BUG] Écran figé', 'Bug', 'Bug signalé depuis un écran'],
      ['[AVIS] Parcours clair', 'Avis', 'Retour depuis un écran'],
      ['[SUGGESTION] Ajouter un filtre', 'Suggestion', 'Retour depuis un écran'],
    ])('« %s » : badge %s, préfixe retiré du texte', (description, badge, reasonLabel) => {
      const w = mount(ReportsTable, { props: { reports: [{ ...screenReport[0], description }], loading: false } })
      expect(w.find('[data-test="report-kind-r2"]').text()).toBe(badge)
      expect(w.text()).toContain(reasonLabel)
      expect(w.text()).not.toContain(description.split(' ')[0])
    })

    it('sans préfixe (ancienne app), aucun badge de type', () => {
      const w = mount(ReportsTable, { props: { reports: screenReport, loading: false } })
      expect(w.find('[data-test="report-kind-r2"]').exists()).toBe(false)
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
  describe('demande d’envoi signalée (PACKAGE_REQUEST)', () => {
    const pr = [{ ...reports[0], id: 'r5', targetType: 'PACKAGE_REQUEST', targetId: 'pr1', targetLabel: 'Paris → Dakar' }]

    it('affiche le type en français, pas le code brut', () => {
      const w = mount(ReportsTable, { props: { reports: pr, loading: false }, global: { stubs: { NuxtLink } } })
      const row = w.find('[data-test="report-row-r5"]')
      expect(row.text()).toContain('Demande d\'envoi')
      expect(row.text()).not.toContain('PACKAGE_REQUEST')
    })

    it('lien « Voir la demande » vers l’onglet Demandes de /colis', () => {
      const w = mount(ReportsTable, { props: { reports: pr, loading: false }, global: { stubs: { NuxtLink } } })
      const link = w.find('[data-test="report-open-request-r5"]')
      expect(link.text()).toBe('Voir la demande')
      expect(link.attributes('href')).toBe('/colis?tab=demandes&open=pr1')
    })

    it('pas de lien sans BID_VIEW', () => {
      seedAuth('SUPPORT', { BID_VIEW: false })
      const w = mount(ReportsTable, { props: { reports: pr, loading: false }, global: { stubs: { NuxtLink } } })
      expect(w.find('[data-test="report-open-request-r5"]').exists()).toBe(false)
    })

    it('pas de lien sur une autre cible ; type inconnu affiché brut', () => {
      const w = mount(ReportsTable, {
        props: { reports: [reports[0], { ...reports[0], id: 'r6', targetType: 'SOMETHING' }], loading: false },
        global: { stubs: { NuxtLink } },
      })
      expect(w.find('[data-test="report-open-request-r1"]').exists()).toBe(false)
      expect(w.find('[data-test="report-row-r1"]').text()).toContain('Utilisateur')
      expect(w.find('[data-test="report-row-r6"]').text()).toContain('SOMETHING')
    })
  })

  describe('résolution : action prise et source des actions', () => {
    it('affiche l’action prise en français sous le statut', () => {
      const done = [{ ...reports[0], status: 'RESOLVED', actionTaken: 'DELETE_MESSAGE' }]
      const w = mount(ReportsTable, { props: { reports: done, loading: false } })
      expect(w.find('[data-test="report-action-taken-r1"]').text()).toBe('Message supprimé')
    })

    it('RESOLVE affiché « Marqué comme traité »', () => {
      const done = [{ ...reports[0], status: 'RESOLVED', actionTaken: 'RESOLVE' }]
      const w = mount(ReportsTable, { props: { reports: done, loading: false } })
      expect(w.find('[data-test="report-action-taken-r1"]').text()).toBe('Marqué comme traité')
    })

    it('rejet : le statut « Rejeté » suffit, pas de doublon', () => {
      const done = [{ ...reports[0], status: 'DISMISSED', actionTaken: 'DISMISS' }]
      const w = mount(ReportsTable, { props: { reports: done, loading: false } })
      expect(w.find('[data-test="report-action-taken-r1"]').exists()).toBe(false)
    })

    it('availableActions non vide : Traiter visible même sans REPORT_RESOLVE local (le back a tranché)', () => {
      seedAuth('SUPPORT', { REPORT_RESOLVE: false })
      const w = mount(ReportsTable, { props: { reports: [{ ...reports[0], availableActions: ['RESOLVE'] }], loading: false } })
      expect(w.find('[data-test="resolve-r1"]').exists()).toBe(true)
    })

    it('availableActions vide : Traiter masqué', () => {
      const w = mount(ReportsTable, { props: { reports: [{ ...reports[0], availableActions: [] }], loading: false } })
      expect(w.find('[data-test="resolve-r1"]').exists()).toBe(false)
    })

    it('MESSAGE sans messageId ni libellé : « Cible inconnue », Traiter disponible', () => {
      const orphan = [{ ...reports[0], targetType: 'MESSAGE', targetId: null, targetLabel: null, availableActions: ['RESOLVE', 'DISMISS'] }]
      const w = mount(ReportsTable, { props: { reports: orphan, loading: false } })
      expect(w.find('[data-test="report-row-r1"]').text()).toContain('Cible inconnue')
      expect(w.find('[data-test="report-row-r1"]').text()).toContain('Message')
      expect(w.find('[data-test="resolve-r1"]').exists()).toBe(true)
    })

    it('signalant inconnu : pas de tiret cadratin affiché', () => {
      const w = mount(ReportsTable, { props: { reports: [{ ...reports[0], reporterName: null }], loading: false } })
      expect(w.find('[data-test="report-row-r1"]').text()).not.toContain('—')
    })
  })
})
