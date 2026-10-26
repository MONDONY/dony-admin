import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportQueue from '@/features/signalements/components/ReportQueue.vue'
import type { AdminReport } from '@/features/signalements/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NOW = new Date('2026-10-26T12:00:00Z').getTime()
const H = 3_600_000

const report: AdminReport = {
  id: 'r1', targetType: 'USER', targetId: 'u9', targetLabel: null, reason: 'SCAM_ATTEMPT', description: 'faux profil',
  reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null,
  resolvedAt: null, createdAt: new Date(NOW - 2 * H).toISOString(), photoUrls: [],
}
const mountQueue = (reports: AdminReport[], extra: Record<string, unknown> = {}) =>
  mount(ReportQueue, { props: { reports, loading: false, now: NOW, ...extra } })

describe('ReportQueue', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('une ligne par signalement : cible, motif en français, signalant', () => {
    const w = mountQueue([report])
    const row = w.find('[data-test="report-row-r1"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('Tentative d’arnaque')
    expect(row.text()).toContain('Awa')
    expect(row.text()).not.toContain('SCAM_ATTEMPT')
  })

  it('cible : nom résolu par le back, sinon identifiant brut', () => {
    expect(mountQueue([{ ...report, targetLabel: 'Fatou Sy' }]).text()).toContain('Fatou Sy')
    expect(mountQueue([report]).text()).toContain('u9')
  })

  it('cible inconnue (MESSAGE sans identifiant ni libellé)', () => {
    const w = mountQueue([{ ...report, targetType: 'MESSAGE', targetId: null as unknown as string, targetLabel: null }])
    expect(w.find('[data-test="report-row-r1"]').text()).toContain('Cible inconnue')
    expect(w.find('[data-test="report-row-r1"]').text()).toContain('Message')
  })

  it('type de cible en français ; un type inconnu s’affiche brut', () => {
    const w = mountQueue([
      { ...report, id: 'r5', targetType: 'PACKAGE_REQUEST' },
      { ...report, id: 'r6', targetType: 'SOMETHING' as AdminReport['targetType'] },
    ])
    expect(w.find('[data-test="report-row-r5"]').text()).toContain('Demande d\'envoi')
    expect(w.find('[data-test="report-row-r5"]').text()).not.toContain('PACKAGE_REQUEST')
    expect(w.find('[data-test="report-row-r6"]').text()).toContain('SOMETHING')
  })

  it('signalant inconnu : « Inconnu », sans tiret cadratin', () => {
    const w = mountQueue([{ ...report, reporterName: null }])
    expect(w.find('[data-test="report-row-r1"]').text()).toContain('Inconnu')
    expect(w.find('[data-test="report-row-r1"]').text()).not.toContain('—')
  })

  describe('âge et urgence d’un signalement ouvert', () => {
    const at = (hours: number) => ({ ...report, createdAt: new Date(NOW - hours * H).toISOString() })

    it('montre l’ancienneté, neutre sous 24 h', () => {
      const w = mountQueue([at(2)])
      const age = w.find('[data-test="report-row-r1"] span.tabular-nums')
      expect(age.text()).toBe('il y a 2 h')
      expect(age.classes()).toContain('text-text-muted')
    })

    it('alerte dès un jour, « en retard » dès trois jours', () => {
      const day = mountQueue([at(30)]).find('[data-test="report-row-r1"] span.tabular-nums')
      expect(day.text()).toBe('il y a 1 j')
      expect(day.classes()).toContain('text-warning')
      const late = mountQueue([at(80)]).find('[data-test="report-row-r1"] span.tabular-nums')
      expect(late.text()).toBe('il y a 3 j · en retard')
      expect(late.classes()).toContain('text-danger')
    })

    it('un signalement traité montre son statut, pas un âge à surveiller', () => {
      const w = mountQueue([{ ...at(100), status: 'RESOLVED' }])
      const row = w.find('[data-test="report-row-r1"]')
      expect(row.text()).toContain('Résolu')
      expect(row.text()).not.toContain('en retard')
    })

    it('un signalement supprimé n’affiche pas d’âge à surveiller', () => {
      const w = mountQueue([{ ...at(100), deletedAt: '2026-10-20T00:00:00Z' }])
      expect(w.find('[data-test="report-row-r1"]').text()).not.toContain('en retard')
    })
  })

  describe('rapport du scarabée (SCREEN_BUG)', () => {
    const screen = { ...report, id: 'r2', targetType: 'APP' as const, targetId: null as unknown as string, reason: 'SCREEN_BUG', screenRoute: '/profile' }

    it('cible « Application » et libellé du motif', () => {
      const w = mountQueue([{ ...screen, description: 'Le badge passe sous le bouton' }])
      expect(w.text()).toContain('Application')
      expect(w.text()).toContain('Bug signalé depuis un écran')
    })

    it.each([
      ['[BUG] Écran figé', 'Bug', 'Bug signalé depuis un écran'],
      ['[AVIS] Parcours clair', 'Avis', 'Retour depuis un écran'],
      ['[SUGGESTION] Ajouter un filtre', 'Suggestion', 'Retour depuis un écran'],
    ])('« %s » : badge %s', (description, badge, reasonLabel) => {
      const w = mountQueue([{ ...screen, description }])
      expect(w.find('[data-test="report-kind-r2"]').text()).toBe(badge)
      expect(w.text()).toContain(reasonLabel)
    })

    it('sans préfixe (ancienne app), aucun badge de type', () => {
      expect(mountQueue([{ ...screen, description: 'Écran figé' }]).find('[data-test="report-kind-r2"]').exists()).toBe(false)
    })
  })

  it('signalement d’avis : nomme la personne notée au lieu de l’identifiant', () => {
    const rating = {
      ...report, id: 'r7', targetType: 'RATING' as const, targetId: 'rating-1', reason: 'INAPPROPRIATE_CONTENT',
      ratingPreview: { stars: 1, comment: 'x', createdAt: '2026-10-14T09:00:00Z', excludedFromAverage: false, ratedUserId: 'u', ratedUserName: 'Moussa T.' },
    }
    const w = mountQueue([rating])
    expect(w.text()).toContain('Avis sur Moussa T.')
    expect(w.text()).not.toContain('rating-1')
    expect(mountQueue([{ ...rating, ratingPreview: { ...rating.ratingPreview, ratedUserName: null } }]).text())
      .toContain('Avis sur un compte supprimé')
  })

  describe('sélection du dossier', () => {
    it('le dossier ouvert est marqué', () => {
      const w = mountQueue([report, { ...report, id: 'r2' }], { selectedId: 'r2' })
      expect(w.find('[data-test="report-open-r2"]').attributes('aria-current')).toBe('true')
      expect(w.find('[data-test="report-open-r1"]').attributes('aria-current')).toBeUndefined()
      expect(w.find('[data-test="report-row-r2"]').attributes('data-selected')).toBe('true')
    })

    it('un clic émet select', async () => {
      const w = mountQueue([report, { ...report, id: 'r2' }])
      await w.find('[data-test="report-open-r2"]').trigger('click')
      expect(w.emitted('select')![0]).toEqual(['r2'])
    })
  })

  describe('cases de sélection groupée (REPORT_DELETE)', () => {
    const two = [report, { ...report, id: 'r2' }]

    it('avec REPORT_DELETE : case par ligne et case de la page', () => {
      const w = mountQueue(two, { checked: ['r1'] })
      expect(w.find('[data-test="select-page"]').exists()).toBe(true)
      expect((w.find('[data-test="select-r1"]').element as HTMLInputElement).checked).toBe(true)
      expect((w.find('[data-test="select-r2"]').element as HTMLInputElement).checked).toBe(false)
    })

    it('émet toggle et togglePage, sans ouvrir le dossier', async () => {
      const w = mountQueue(two)
      await w.find('[data-test="select-r2"]').trigger('change')
      expect(w.emitted('toggle')![0]).toEqual(['r2'])
      await w.find('[data-test="select-page"]').trigger('change')
      expect(w.emitted('togglePage')).toHaveLength(1)
      expect(w.emitted('select')).toBeUndefined()
    })

    it('case de la page cochée quand toute la page l’est', () => {
      const w = mountQueue(two, { checked: ['r1', 'r2'] })
      expect((w.find('[data-test="select-page"]').element as HTMLInputElement).checked).toBe(true)
    })

    it('sans REPORT_DELETE : aucune case', () => {
      seedAuth('SUPPORT', { REPORT_DELETE: false })
      const w = mountQueue(two)
      expect(w.find('[data-test="select-page"]').exists()).toBe(false)
      expect(w.find('[data-test="select-r1"]').exists()).toBe(false)
    })
  })

  it('un signalement supprimé reste lisible, en grisé', () => {
    const w = mountQueue([{ ...report, deletedAt: '2026-09-20T10:00:00Z' }])
    expect(w.find('[data-test="report-open-r1"]').classes()).toContain('text-text-muted')
  })

  it('état vide', () => {
    expect(mountQueue([]).text()).toMatch(/Aucun signalement/i)
  })

  it('état de chargement', () => {
    expect(mountQueue([], { loading: true }).text()).toMatch(/Chargement/i)
  })
})
