import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingCase from '@/features/signalements/components/RatingCase.vue'
import type { AdminRating, RatingContext } from '@/features/signalements/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const BID = '33333333-3333-4333-8333-333333333333'

const rating: AdminRating = {
  id: 'rt1', bidId: BID, raterName: 'Awa Diallo', ratedName: 'Karim Sy', score: 1, comment: 'arnaqueur',
  flagged: true, excluded: false, excludedReason: null, createdAt: '2026-10-20T10:00:00Z',
}
const ctx = (extra: Partial<RatingContext> = {}): RatingContext => ({
  sameRelationCount: 1, openReports: 0, reports: [], history: [], ...extra,
})
const mountCase = (r: AdminRating | null, extra: Record<string, unknown> = {}) =>
  mount(RatingCase, { props: { rating: r, ...extra }, global: { stubs: { NuxtLink } } })

describe('RatingCase', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('sans avis sélectionné', () => {
    expect(mountCase(null).find('[data-test="rating-case-empty"]').text()).toBe('Aucun avis sélectionné.')
  })

  describe('en-tête', () => {
    it('note, noms, commentaire et lien vers la livraison', () => {
      const w = mountCase(rating)
      expect(w.find('[data-test="rating-case-stars"]').attributes('aria-label')).toBe('1 étoile sur 5')
      expect(w.text()).toContain('1/5')
      expect(w.text()).toContain('Awa Diallo → Karim Sy')
      expect(w.find('[data-test="rating-case-comment"]').text()).toContain('arnaqueur')
      expect(w.find('[data-test="rating-case-flagged"]').text()).toBe('Signalé')
      expect(w.find('[data-test="rating-case-delivery"]').attributes('href')).toContain(BID)
    })

    it('pas de lien vers la livraison sans BID_VIEW ni sans identifiant', () => {
      seedAuth('SUPPORT', { BID_VIEW: false })
      expect(mountCase(rating).find('[data-test="rating-case-delivery"]').exists()).toBe(false)
      seedAuth('ADMIN')
      expect(mountCase({ ...rating, bidId: null }).find('[data-test="rating-case-delivery"]').exists()).toBe(false)
    })

    it('avis exclu : badge, commentaire barré et motif', () => {
      const w = mountCase({ ...rating, excluded: true, excludedReason: 'diffamatoire' })
      expect(w.find('[data-test="rating-case-excluded"]').text()).toBe('Exclu de la moyenne')
      expect(w.find('[data-test="rating-case-comment"] .line-through').exists()).toBe(true)
      expect(w.find('[data-test="rating-case-excluded-reason"]').text()).toBe('Exclu : diffamatoire')
      expect(w.text()).not.toMatch(/Exclu —/)
    })

    it('avis supprimé : qui, quand et le motif', () => {
      const w = mountCase({ ...rating, deletedAt: '2026-09-20T10:00:00Z', deletedByAdminEmail: 'mod@yadony.com', deleteReason: 'insulte' })
      const info = w.find('[data-test="rating-deleted-info-rt1"]')
      expect(info.text()).toContain('mod@yadony.com')
      expect(info.text()).toContain('20/09/2026')
      expect(info.text()).toContain('Motif : insulte')
      expect(w.find('[data-test="rating-case-deleted"]').text()).toBe('Supprimé')
      expect(w.find('[data-test="rating-case-excluded"]').exists()).toBe(false)
    })

    it('sans auteur ni motif de suppression : reste lisible', () => {
      const w = mountCase({ ...rating, deletedAt: '2026-09-20T10:00:00Z' })
      const text = w.find('[data-test="rating-deleted-info-rt1"]').text()
      expect(text).toContain('Supprimé le')
      expect(text).not.toContain('par')
      expect(text).not.toContain('Motif')
    })

    it('champs manquants : libellés de repli', () => {
      const w = mountCase({ ...rating, comment: null, raterName: null, ratedName: null })
      expect(w.text()).toContain('Sans commentaire')
      expect(w.text()).toContain('Anonyme → Compte supprimé')
    })
  })

  it('chargement et échec du contexte : une phrase discrète, l’avis reste lisible', () => {
    expect(mountCase(rating, { contextLoading: true }).find('[data-test="rating-context-loading"]').text()).toBe('Chargement du contexte…')
    const failed = mountCase(rating, { contextError: 'Contexte indisponible' })
    expect(failed.find('[data-test="rating-context-error"]').text()).toBe('Contexte indisponible')
    expect(failed.find('[data-test="rating-case-comment"]').exists()).toBe(true)
  })

  it('sans contexte (ancien back) : aucune fiche ni historique', () => {
    const w = mountCase(rating, { context: null })
    for (const t of ['rating-rater-given', 'rating-rated-average', 'rating-history', 'rating-reports']) {
      expect(w.find(`[data-test="${t}"]`).exists()).toBe(false)
    }
  })

  describe('fiche du notant', () => {
    const rater = { userId: U1, displayName: 'Awa Diallo', memberSince: '2026-03-01T09:00:00', ratingsGiven: 12, averageGiven: 1.8, lowRatingsGiven: 10 }

    it('avis donnés, moyenne, notes basses et repère « note presque toujours bas »', () => {
      const w = mountCase(rating, { context: ctx({ rater }) })
      expect(w.find('[data-test="rating-rater-given"]').text()).toBe('12 avis donnés, moyenne 1,8')
      expect(w.find('[data-test="rating-rater-low"]').text()).toBe('dont 10 de 2 étoiles ou moins')
      expect(w.find('[data-test="rating-rater-habit"]').text()).toBe('Note presque toujours bas')
      expect(w.text()).toContain('Membre depuis mars 2026')
    })

    it('peu d’avis ou notes variées : pas de repère ; sans moyenne : pas de moyenne', () => {
      const w = mountCase(rating, { context: ctx({ rater: { ...rater, ratingsGiven: 1, averageGiven: null, lowRatingsGiven: 0 } }) })
      expect(w.find('[data-test="rating-rater-habit"]').exists()).toBe(false)
      expect(w.find('[data-test="rating-rater-given"]').text()).toBe('1 avis donné')
      expect(w.find('[data-test="rating-rater-low"]').exists()).toBe(false)
    })

    it('lien vers la fiche avec USER_VIEW, simple nom sans', () => {
      expect(mountCase(rating, { context: ctx({ rater }) }).find('[data-test="rating-rater-link"]').attributes('href')).toBe(`/users/${U1}`)
      seedAuth('ADMIN', { USER_VIEW: false })
      const w = mountCase(rating, { context: ctx({ rater }) })
      expect(w.find('[data-test="rating-rater-link"]').exists()).toBe(false)
      expect(w.text()).toContain('Awa Diallo')
    })

    it('avis anonyme : dit pourquoi il n’y a pas de fiche', () => {
      const w = mountCase(rating, { context: ctx() })
      expect(w.find('[data-test="rating-rater-anonymous"]').text()).toContain('anonyme')
    })

    it('plusieurs notes du même compte au même compte : signalé', () => {
      const w = mountCase(rating, { context: ctx({ rater, sameRelationCount: 3 }) })
      expect(w.find('[data-test="rating-same-relation"]').text()).toBe('3 notes de Awa Diallo à Karim Sy')
      expect(mountCase(rating, { context: ctx({ rater, sameRelationCount: 1 }) }).find('[data-test="rating-same-relation"]').exists()).toBe(false)
    })
  })

  describe('fiche de la personne notée', () => {
    const rated = {
      userId: U2, displayName: 'Karim Sy', memberSince: '2026-01-10T08:00:00', averageRating: 4.2,
      ratingCount: 18, excludedCount: 2, distribution: { '5': 12, '4': 4, '1': 2 },
    }

    it('moyenne, avis comptés, exclus et répartition', () => {
      const w = mountCase(rating, { context: ctx({ rated }) })
      expect(w.find('[data-test="rating-rated-average"]').text()).toContain('4,2')
      expect(w.find('[data-test="rating-rated-average"]').text()).toContain('18 avis comptés')
      expect(w.find('[data-test="rating-rated-excluded"]').text()).toBe('2 exclus de la moyenne')
      expect(w.findAll('[data-test="rating-distribution"] li')).toHaveLength(5)
      expect(w.find('[data-test="rating-distribution"] li').text()).toContain('12')
    })

    it('un seul avis compté, un seul exclu : accords au singulier', () => {
      const w = mountCase(rating, { context: ctx({ rated: { ...rated, ratingCount: 1, excludedCount: 1 } }) })
      expect(w.find('[data-test="rating-rated-average"]').text()).toContain('1 avis compté')
      expect(w.find('[data-test="rating-rated-average"]').text()).not.toContain('avis comptés')
      expect(w.find('[data-test="rating-rated-excluded"]').text()).toBe('1 exclu de la moyenne')
    })

    it('aucune moyenne, aucun exclu : lignes sobres', () => {
      const w = mountCase(rating, { context: ctx({ rated: { ...rated, averageRating: null, ratingCount: 0, excludedCount: 0, distribution: null } }) })
      expect(w.find('[data-test="rating-rated-average"]').text()).toContain('aucune moyenne')
      expect(w.find('[data-test="rating-rated-excluded"]').exists()).toBe(false)
    })

    it('lien vers la fiche avec USER_VIEW ; compte supprimé sinon', () => {
      expect(mountCase(rating, { context: ctx({ rated }) }).find('[data-test="rating-rated-link"]').attributes('href')).toBe(`/users/${U2}`)
      expect(mountCase(rating, { context: ctx() }).text()).toContain('Compte supprimé.')
    })
  })

  describe('signalements sur l’avis', () => {
    const reports = [
      { id: 's1', reason: 'INAPPROPRIATE_CONTENT', status: 'OPEN', createdAt: '2026-10-25T08:00:00Z', reporterName: 'Fatou Kane' },
    ]

    it('liste, ouverts, et un clic émet openReport', async () => {
      const w = mountCase(rating, { context: ctx({ reports, openReports: 1 }) })
      expect(w.find('[data-test="rating-reports-open"]').text()).toContain('1 ouvert')
      await w.find('[data-test="rating-reports"] [data-test="related-s1"]').trigger('click')
      expect(w.emitted('openReport')![0]).toEqual(['s1'])
    })

    it('aucun signalement : pas de section', () => {
      expect(mountCase(rating, { context: ctx() }).find('[data-test="rating-reports"]').exists()).toBe(false)
    })

    it('sans REPORT_VIEW : une phrase, aucune liste', () => {
      const w = mountCase(rating, { context: ctx({ reportsRestricted: true }) })
      expect(w.find('[data-test="rating-reports-restricted"]').text()).toContain('pas visibles avec votre rôle')
      expect(w.find('[data-test="rating-reports"]').exists()).toBe(false)
    })
  })

  it('historique : création déduite puis gestes, du plus ancien au plus récent', () => {
    const w = mountCase(rating, {
      context: ctx({
        history: [
          { action: 'RATING_EXCLUDED', detail: 'REINTEGRATED', at: '2026-10-22T09:00:00Z', actorEmail: 'sira@yadony.com' },
          { action: 'RATING_EXCLUDED', at: '2026-10-21T09:00:00Z', actorEmail: 'sira@yadony.com', note: 'doute' },
        ],
      }),
    })
    const items = w.findAll('[data-test^="timeline-"]').map((i) => i.text())
    expect(items).toHaveLength(3)
    expect(items[0]).toContain('Avis laissé')
    expect(items[1]).toContain('Avis exclu de la moyenne')
    expect(items[1]).toContain('doute')
    expect(items[2]).toContain('Avis réintégré dans la moyenne')
  })
})
