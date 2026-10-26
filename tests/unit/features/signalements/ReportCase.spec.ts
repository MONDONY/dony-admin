import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportCase from '@/features/signalements/components/ReportCase.vue'
import type { AdminReport } from '@/features/signalements/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }

const report: AdminReport = {
  id: 'r1', targetType: 'USER', targetId: 'u9', targetLabel: 'Moussa Ba', reason: 'SCAM_ATTEMPT', description: 'faux profil',
  reporterName: 'Awa', status: 'OPEN', actionTaken: null, resolutionNote: null,
  resolvedAt: null, createdAt: '2026-06-01T10:00:00Z', photoUrls: [],
}
const bug: AdminReport = {
  ...report, targetType: 'APP', targetId: '' as unknown as string, targetLabel: null, reason: 'SCREEN_BUG',
  description: 'Écran figé', screenRoute: '/home',
}
const mountCase = (r: AdminReport | null, extra: Record<string, unknown> = {}) =>
  mount(ReportCase, { props: { report: r, ...extra }, global: { stubs: { NuxtLink } } })

describe('ReportCase', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('sans signalement sélectionné', () => {
    expect(mountCase(null).find('[data-test="case-empty"]').text()).toBe('Aucun signalement sélectionné.')
  })

  describe('contenu du dossier', () => {
    it('motif en français, texte du signalant, cible, signalant', () => {
      const w = mountCase(report)
      expect(w.text()).toContain('Tentative d’arnaque')
      expect(w.text()).not.toContain('SCAM_ATTEMPT')
      expect(w.find('[data-test="case-description"]').text()).toContain('faux profil')
      expect(w.find('[data-test="case-description"]').text()).toContain('Awa')
      expect(w.text()).toContain('Moussa Ba')
      expect(w.text()).toContain('Utilisateur')
    })

    it('signalant inconnu : « Inconnu », sans tiret cadratin', () => {
      const w = mountCase({ ...report, reporterName: null })
      expect(w.text()).toContain('Inconnu')
      expect(w.text()).not.toContain('—')
    })

    it('numéro court du signalement et statut', () => {
      const w = mountCase({ ...report, id: 'abcdef1234567890' })
      expect(w.text()).toContain('n° abcdef12')
      expect(w.text()).toContain('Ouvert')
    })

    it('émet viewPhotos au clic sur une capture', async () => {
      const w = mountCase({ ...report, photoUrls: ['https://example.test/a.png'] })
      await w.find('[data-test="report-photo-r1-0"]').trigger('click')
      expect(w.emitted('viewPhotos')?.[0]).toEqual([['https://example.test/a.png']])
    })

    it('auteur du contenu signalé nommé quand le back le fournit', () => {
      const w = mountCase({ ...report, targetType: 'MESSAGE', targetAuthor: { userId: 'u2', name: 'Moussa B.' } })
      expect(w.text()).toContain('Auteur : Moussa B.')
    })
  })

  describe('rapport du scarabée (SCREEN_BUG, cible APP)', () => {
    it('route de l’écran d’origine, cible « Application », libellé du motif', () => {
      const w = mountCase(bug)
      expect(w.find('[data-test="report-screen-r1"]').text()).toBe('Écran /home')
      expect(w.text()).toContain('Application')
      expect(w.text()).toContain('Bug signalé depuis un écran')
    })

    it.each([
      ['[BUG] Écran figé', 'Bug', 'Bug signalé depuis un écran'],
      ['[AVIS] Parcours clair', 'Avis', 'Retour depuis un écran'],
      ['[SUGGESTION] Ajouter un filtre', 'Suggestion', 'Retour depuis un écran'],
    ])('« %s » : badge %s, préfixe retiré du texte', (description, badge, reasonLabel) => {
      const w = mountCase({ ...bug, description })
      expect(w.find('[data-test="report-kind-r1"]').text()).toBe(badge)
      expect(w.text()).toContain(reasonLabel)
      expect(w.find('[data-test="case-description"]').text()).not.toContain(description.split(' ')[0])
    })

    it('sans préfixe, aucun badge de type ; sans route, pas de ligne Écran', () => {
      const w = mountCase({ ...bug, screenRoute: null })
      expect(w.find('[data-test="report-kind-r1"]').exists()).toBe(false)
      expect(w.find('[data-test="report-screen-r1"]').exists()).toBe(false)
    })
  })

  describe('demande d’envoi signalée (PACKAGE_REQUEST)', () => {
    const pr = { ...report, id: 'r5', targetType: 'PACKAGE_REQUEST' as const, targetId: 'pr1', targetLabel: 'Paris → Dakar' }

    it('type en français et lien « Voir la demande » vers l’onglet Demandes de /colis', () => {
      const w = mountCase(pr)
      expect(w.text()).toContain('Demande d\'envoi')
      expect(w.text()).not.toContain('PACKAGE_REQUEST')
      const link = w.find('[data-test="report-open-request-r5"]')
      expect(link.text()).toBe('Voir la demande')
      expect(link.attributes('href')).toBe('/colis?tab=demandes&open=pr1')
    })

    it('pas de lien sans BID_VIEW, ni sur une autre cible', () => {
      seedAuth('SUPPORT', { BID_VIEW: false })
      expect(mountCase(pr).find('[data-test="report-open-request-r5"]').exists()).toBe(false)
      seedAuth('ADMIN')
      expect(mountCase(report).find('[data-test="report-open-request-r1"]').exists()).toBe(false)
    })
  })

  describe('signalement d’avis : l’avis se lit dans le dossier', () => {
    const rating: AdminReport = {
      ...report, id: 'r7', targetType: 'RATING', targetId: 'rating-1', targetLabel: null, reason: 'INAPPROPRIATE_CONTENT',
      targetAuthor: { userId: 'u-auteur', name: 'Awa D.' },
      ratingPreview: {
        stars: 1, comment: 'Voyageur malhonnête', createdAt: '2026-10-14T09:00:00Z',
        excludedFromAverage: false, ratedUserId: 'u-note', ratedUserName: 'Moussa T.',
      },
    }

    it('étoiles, commentaire et personne notée au lieu de l’identifiant', () => {
      const w = mountCase(rating)
      expect(w.text()).toContain('Avis sur Moussa T.')
      expect(w.text()).not.toContain('rating-1')
      expect(w.find('[data-test="report-rating-comment-r7"]').text()).toContain('Voyageur malhonnête')
      expect(w.find('[data-test="report-rating-stars-r7"]').attributes('aria-label')).toBe('1 étoile sur 5')
    })

    it('fiches de la personne notée et de l’auteur ; avis exclu signalé', () => {
      const w = mountCase({ ...rating, ratingPreview: { ...rating.ratingPreview!, excludedFromAverage: true } })
      expect(w.find('[data-test="report-rating-rated-r7"]').attributes('href')).toBeDefined()
      expect(w.find('[data-test="report-rating-author-r7"]').text()).toBe('Awa D.')
      expect(w.find('[data-test="report-rating-excluded-r7"]').text()).toBe('Exclu de la moyenne')
    })

    it('sans USER_VIEW, les noms restent lisibles sans lien', () => {
      seedAuth('ADMIN', { USER_VIEW: false })
      const w = mountCase(rating)
      expect(w.find('[data-test="report-rating-author-r7"]').exists()).toBe(false)
      expect(w.text()).toContain('Awa D.')
    })

    it('ancien back sans aperçu : l’identifiant reste affiché', () => {
      const w = mountCase({ ...rating, ratingPreview: undefined })
      expect(w.text()).toContain('rating-1')
      expect(w.find('[data-test="report-rating-r7"]').exists()).toBe(false)
    })
  })

  describe('issue d’un signalement déjà traité', () => {
    it('action prise en français, note interne et date', () => {
      const w = mountCase({
        ...report, status: 'RESOLVED', actionTaken: 'DELETE_MESSAGE', resolutionNote: 'insultes',
        resolvedAt: '2026-06-02T10:00:00Z',
      })
      expect(w.find('[data-test="report-action-taken-r1"]').text()).toBe('Message supprimé')
      expect(w.text()).toContain('Note interne : insultes')
    })

    it('RESOLVE affiché « Marqué comme traité »', () => {
      const w = mountCase({ ...report, status: 'RESOLVED', actionTaken: 'RESOLVE' })
      expect(w.find('[data-test="report-action-taken-r1"]').text()).toBe('Marqué comme traité')
    })

    it('rejet : le statut « Rejeté » suffit, pas de doublon', () => {
      const w = mountCase({ ...report, status: 'DISMISSED', actionTaken: 'DISMISS' })
      expect(w.find('[data-test="report-action-taken-r1"]').exists()).toBe(false)
      expect(w.text()).toContain('Rejeté')
    })

    it('signalement ouvert : pas de bloc Issue', () => {
      expect(mountCase(report).find('section[aria-label="Issue"]').exists()).toBe(false)
    })
  })

  describe('répondre au signalant', () => {
    it('canReply du back : bouton Répondre qui émet reply', async () => {
      const w = mountCase({ ...bug, canReply: true })
      const btn = w.find('[data-test="reply-r1"]')
      expect(btn.text()).toBe('Répondre au signalant')
      await btn.trigger('click')
      expect(w.emitted('reply')?.[0]).toEqual(['r1'])
    })

    it('canReply false : pas de bouton', () => {
      expect(mountCase({ ...bug, canReply: false }).find('[data-test="reply-r1"]').exists()).toBe(false)
    })

    it('ancien back : visible sur une cible APP avec SUPPORT_TICKET_MANAGE', () => {
      expect(mountCase(bug).find('[data-test="reply-r1"]').exists()).toBe(true)
      expect(mountCase({ ...bug, targetType: 'USER' }).find('[data-test="reply-r1"]').exists()).toBe(false)
      seedAuth('SUPPORT', { SUPPORT_TICKET_MANAGE: false })
      expect(mountCase(bug).find('[data-test="reply-r1"]').exists()).toBe(false)
    })

    it('sans supportTicketId : pas de badge', () => {
      expect(mountCase({ ...bug, canReply: true }).find('[data-test="report-conversation-r1"]').exists()).toBe(false)
    })

    it('conversation ouverte : badge, lien vers le fil et « Répondre à nouveau »', () => {
      const w = mountCase({ ...bug, canReply: true, supportTicketId: 't9' })
      expect(w.find('[data-test="report-conversation-r1"]').text()).toContain('Conversation ouverte')
      expect(w.find('[data-test="report-conversation-link-r1"]').attributes('href')).toBe('/support?ticket=t9')
      expect(w.find('[data-test="reply-r1"]').text()).toBe('Répondre à nouveau')
    })

    it('sans SUPPORT_TICKET_VIEW : badge sans lien', () => {
      seedAuth('ADMIN', { SUPPORT_TICKET_VIEW: false })
      const w = mountCase({ ...bug, canReply: true, supportTicketId: 't9' })
      expect(w.find('[data-test="report-conversation-r1"]').exists()).toBe(true)
      expect(w.find('[data-test="report-conversation-link-r1"]').exists()).toBe(false)
    })

    it('signalement déjà traité ou rejeté : Répondre reste proposé si canReply', () => {
      for (const status of ['RESOLVED', 'DISMISSED'] as const) {
        expect(mountCase({ ...bug, status, canReply: true }).find('[data-test="reply-r1"]').exists()).toBe(true)
      }
    })

    it('un signalement supprimé ne propose pas de répondre', () => {
      const w = mountCase({ ...bug, canReply: true, deletedAt: '2026-09-21T10:00:00Z' })
      expect(w.find('[data-test="reply-r1"]').exists()).toBe(false)
    })
  })

  describe('suppression (REPORT_DELETE)', () => {
    it('Supprimer émet delete', async () => {
      const w = mountCase(report)
      await w.find('[data-test="delete-r1"]').trigger('click')
      expect(w.emitted('delete')![0]).toEqual(['r1'])
    })

    it('sans REPORT_DELETE : pas de bouton Supprimer', () => {
      seedAuth('SUPPORT', { REPORT_DELETE: false })
      expect(mountCase(report).find('[data-test="delete-r1"]').exists()).toBe(false)
    })
  })

  describe('signalement supprimé', () => {
    const deleted = { ...report, deletedAt: '2026-09-20T10:00:00Z', deletedByAdminEmail: 'mod@yadony.com' }

    it('montre qui et quand, un bouton Restaurer, ni Supprimer ni Répondre', async () => {
      const w = mountCase(deleted)
      const info = w.find('[data-test="report-deleted-info-r1"]')
      expect(info.text()).toContain('mod@yadony.com')
      expect(info.text()).toContain('20/09/2026')
      expect(w.find('[data-test="delete-r1"]').exists()).toBe(false)
      await w.find('[data-test="restore-r1"]').trigger('click')
      expect(w.emitted('restore')![0]).toEqual(['r1'])
    })

    it('sans auteur connu, reste lisible', () => {
      const w = mountCase({ ...deleted, deletedByAdminEmail: undefined })
      expect(w.find('[data-test="report-deleted-info-r1"]').text()).toContain('Supprimé le')
      expect(w.find('[data-test="report-deleted-info-r1"]').text()).not.toContain('par')
    })

    it('masque Restaurer quand l’endpoint est indisponible', () => {
      expect(mountCase(deleted, { restoreUnavailable: true }).find('[data-test="restore-r1"]').exists()).toBe(false)
    })

    it('masque Restaurer sans REPORT_DELETE', () => {
      seedAuth('SUPPORT')
      expect(mountCase(deleted).find('[data-test="restore-r1"]').exists()).toBe(false)
    })
  })
})
