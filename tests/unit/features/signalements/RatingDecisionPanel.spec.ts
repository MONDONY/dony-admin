import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingDecisionPanel from '@/features/signalements/components/RatingDecisionPanel.vue'
import type { AdminRating, RatingContext } from '@/features/signalements/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const rating: AdminRating = {
  id: 'rt1', bidId: 'b1', raterName: 'Awa Diallo', ratedName: 'Karim Sy', score: 1, comment: 'arnaqueur',
  flagged: true, excluded: false, excludedReason: null, createdAt: '2026-10-20T10:00:00Z',
}
const deleted: AdminRating = { ...rating, deletedAt: '2026-09-20T10:00:00Z' }
const context: RatingContext = {
  sameRelationCount: 1, openReports: 0,
  rated: { userId: 'u2', displayName: 'Karim Sy', averageRating: 4, ratingCount: 5, excludedCount: 0 },
}

function mountPanel(r: AdminRating | null, extra: Record<string, unknown> = {}) {
  return mount(RatingDecisionPanel, { props: { rating: r, ...extra } })
}
type Panel = ReturnType<typeof mountPanel>
const confirmBtn = (w: Panel) => w.find('[data-test="rating-confirm"]')
const reason = (w: Panel) => w.find('[data-test="rating-reason"]')
const exposed = (w: Panel) => w.vm as unknown as { pick: (_n: number) => void; submit: () => void }
async function choose(w: Panel, action: string) {
  await w.find(`[data-test="rating-action-${action}"] input`).setValue(true)
}
const labels = (w: Panel) => w.findAll('[data-test="rating-action-label"]').map((x) => x.text())

describe('RatingDecisionPanel', () => {
  beforeEach(() => seedAuth('ADMIN'))

  describe('gestes proposés', () => {
    it('sans avis : invite à en choisir un, rien à confirmer', () => {
      const w = mountPanel(null)
      expect(w.find('[data-test="rating-decision-empty"]').exists()).toBe(true)
      expect(confirmBtn(w).exists()).toBe(false)
    })

    it('avis actif : exclure puis supprimer, numérotés', () => {
      const w = mountPanel(rating)
      expect(labels(w)).toEqual(['Exclure de la moyenne', 'Supprimer l’avis'])
      expect(w.findAll('[data-test^="rating-action-"] kbd').map((k) => k.text())).toEqual(['1', '2'])
      expect(w.text()).toContain('Touches 1 à 2')
    })

    it('avis exclu : réintégrer puis supprimer', () => {
      expect(labels(mountPanel({ ...rating, excluded: true }))).toEqual(['Réintégrer dans la moyenne', 'Supprimer l’avis'])
    })

    it('avis supprimé : seulement restaurer', () => {
      expect(labels(mountPanel(deleted))).toEqual(['Restaurer l’avis'])
    })

    it('SUPPORT peut exclure mais pas supprimer ; ADMIN peut supprimer', () => {
      seedAuth('SUPPORT')
      expect(labels(mountPanel(rating))).toEqual(['Exclure de la moyenne'])
      seedAuth('ADMIN')
      expect(labels(mountPanel(rating))).toContain('Supprimer l’avis')
    })

    it('sans RATING_DELETE : pas de restauration ; un message le dit', () => {
      seedAuth('SUPPORT')
      const w = mountPanel(deleted)
      expect(w.find('[data-test="rating-no-action"]').text()).toContain('Aucune action disponible')
      expect(confirmBtn(w).exists()).toBe(false)
    })

    it('restauration indisponible (ancien back) : plus de geste', () => {
      const w = mountPanel(deleted, { restoreUnavailable: true })
      expect(w.find('[data-test="rating-no-action"]').exists()).toBe(true)
      expect(w.find('[data-test="rating-action-RESTORE"]').exists()).toBe(false)
    })

    it('avis supplanté : le panneau explique pourquoi on ne peut plus restaurer', () => {
      const w = mountPanel(deleted, { superseded: true })
      expect(w.find('[data-test="rating-no-action"]').text()).toContain('ne peut plus être restauré')
      expect(confirmBtn(w).exists()).toBe(false)
    })
  })

  describe('motif et confirmation', () => {
    it('le premier geste est choisi d’office, mais rien ne part sans motif', async () => {
      const w = mountPanel(rating)
      expect((w.find('[data-test="rating-action-EXCLUDE"] input').element as HTMLInputElement).checked).toBe(true)
      expect(confirmBtn(w).attributes('disabled')).toBeDefined()
      expect(reason(w).attributes('placeholder')).toBe('Motif (obligatoire)')
      await confirmBtn(w).trigger('click')
      expect(w.emitted('confirm')).toBeUndefined()
    })

    it('exclure : le motif saisi (nettoyé) part avec le geste', async () => {
      const w = mountPanel(rating)
      await reason(w).setValue('  propos diffamatoires  ')
      expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
      await confirmBtn(w).trigger('click')
      expect(w.emitted('confirm')![0]).toEqual(['EXCLUDE', 'propos diffamatoires'])
    })

    it('motifs rapides : un clic remplit le motif ; aucun pour une réintégration', async () => {
      const w = mountPanel(rating)
      await w.find('[data-test="rating-quick-Représailles"]').trigger('click')
      expect((reason(w).element as HTMLTextAreaElement).value).toBe('Représailles')
      const back = mountPanel({ ...rating, excluded: true })
      expect(back.find('[data-test="rating-quick-reasons"]').exists()).toBe(false)
    })

    it('réintégrer : motif facultatif, confirmable sans', async () => {
      const w = mountPanel({ ...rating, excluded: true })
      expect(reason(w).attributes('placeholder')).toBe('Motif (facultatif)')
      expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
      await confirmBtn(w).trigger('click')
      expect(w.emitted('confirm')![0]).toEqual(['REINTEGRATE', ''])
    })

    it('un motif de plus de 500 caractères est refusé avant l’envoi', async () => {
      const w = mountPanel(rating)
      await reason(w).setValue('x'.repeat(501))
      expect(w.find('[data-test="rating-reason-problem"]').text()).toBe('Au plus 500 caractères.')
      expect(confirmBtn(w).attributes('disabled')).toBeDefined()
    })

    it('restaurer : entre 10 et 500 caractères, journalisé', async () => {
      const w = mountPanel(deleted)
      expect(reason(w).attributes('placeholder')).toContain('10 à 500 caractères')
      await reason(w).setValue('court')
      expect(w.find('[data-test="rating-reason-problem"]').text()).toContain('Entre 10 et 500 caractères')
      expect(confirmBtn(w).attributes('disabled')).toBeDefined()
      await w.find('[data-test="rating-quick-Suppression par erreur"]').trigger('click')
      expect(w.find('[data-test="rating-reason-problem"]').exists()).toBe(false)
      await confirmBtn(w).trigger('click')
      expect(w.emitted('confirm')![0]).toEqual(['RESTORE', 'Suppression par erreur'])
    })

    it('compteur de caractères pour exclure et supprimer, pas pour restaurer', async () => {
      const w = mountPanel(rating)
      await reason(w).setValue('abc')
      expect(w.text()).toContain('3/500')
      expect(mountPanel(deleted).text()).not.toContain('/500')
    })
  })

  describe('suppression : confirmation renforcée', () => {
    it('conséquence nommée et case à cocher avant d’envoyer', async () => {
      const w = mountPanel(rating)
      await choose(w, 'DELETE')
      expect(w.find('[data-test="rating-consequence"]').text()).toContain('profil de Karim Sy')
      await reason(w).setValue('contenu illicite')
      expect(confirmBtn(w).attributes('disabled')).toBeDefined()
      await w.find('[data-test="rating-acknowledge"]').setValue(true)
      expect(confirmBtn(w).attributes('disabled')).toBeUndefined()
      expect(confirmBtn(w).text()).toContain('Supprimer l’avis')
      await confirmBtn(w).trigger('click')
      expect(w.emitted('confirm')![0]).toEqual(['DELETE', 'contenu illicite'])
    })

    it('exclure n’a pas de confirmation renforcée', () => {
      expect(mountPanel(rating).find('[data-test="rating-consequence"]').exists()).toBe(false)
    })

    it('changer de geste réarme la case', async () => {
      const w = mountPanel(rating)
      await choose(w, 'DELETE')
      await w.find('[data-test="rating-acknowledge"]').setValue(true)
      await choose(w, 'EXCLUDE')
      await choose(w, 'DELETE')
      expect((w.find('[data-test="rating-acknowledge"]').element as HTMLInputElement).checked).toBe(false)
    })
  })

  describe('effet sur la moyenne, et ce qui part', () => {
    it('exclure : la moyenne de la personne notée avant → après', () => {
      const w = mountPanel(rating, { context })
      expect(w.find('[data-test="rating-effect"]').text()).toBe('Moyenne de Karim Sy : 4,0 → 4,8 (4 avis)')
    })

    it('l’effet suit le geste choisi', async () => {
      const w = mountPanel({ ...rating, excluded: true }, { context })
      expect(w.find('[data-test="rating-effect"]').text()).toBe('Moyenne de Karim Sy : 4,0 → 3,5 (6 avis)')
    })

    it('sans contexte ou avis déjà hors moyenne : pas d’effet affiché', () => {
      expect(mountPanel(rating).find('[data-test="rating-effect"]').exists()).toBe(false)
      expect(mountPanel(deleted, { context }).find('[data-test="rating-effect"]').exists()).toBe(true) // restaurer l'y remet
      expect(mountPanel({ ...deleted, excluded: true }, { context }).find('[data-test="rating-effect"]').exists()).toBe(false)
    })

    it('personne n’est prévenu', () => {
      expect(mountPanel(rating).find('[data-test="rating-preview"]').text()).toContain('Personne n’est prévenu')
    })
  })

  describe('bouton et raccourcis', () => {
    it('nomme le geste et annonce le suivant ; dernier avis : plus de « suivant »', () => {
      expect(confirmBtn(mountPanel(rating)).text()).toContain('Exclure de la moyenne et passer au suivant')
      expect(confirmBtn(mountPanel(rating, { hasNext: false })).text()).not.toContain('passer au suivant')
    })

    it('pick(n) choisit le n-ième geste, hors plage sans effet', async () => {
      const w = mountPanel(rating)
      exposed(w).pick(2)
      await w.vm.$nextTick()
      expect((w.find('[data-test="rating-action-DELETE"] input').element as HTMLInputElement).checked).toBe(true)
      exposed(w).pick(9)
      await w.vm.$nextTick()
      expect((w.find('[data-test="rating-action-DELETE"] input').element as HTMLInputElement).checked).toBe(true)
    })

    it('submit() confirme comme le bouton, et rien tant que la saisie est incomplète', async () => {
      const w = mountPanel(rating)
      exposed(w).submit()
      expect(w.emitted('confirm')).toBeUndefined()
      await reason(w).setValue('insultes')
      exposed(w).submit()
      expect(w.emitted('confirm')![0]).toEqual(['EXCLUDE', 'insultes'])
    })

    it('un autre avis repart de zéro : motif vide, premier geste', async () => {
      const w = mountPanel(rating)
      await choose(w, 'DELETE')
      await reason(w).setValue('x')
      await w.setProps({ rating: { ...rating, id: 'rt2' } })
      expect((reason(w).element as HTMLTextAreaElement).value).toBe('')
      expect((w.find('[data-test="rating-action-EXCLUDE"] input').element as HTMLInputElement).checked).toBe(true)
    })
  })

  describe('refus et attente', () => {
    it('affiche le refus du back dans le panneau, saisie conservée', async () => {
      const w = mountPanel(rating, { error: 'Permission RATING_MODERATE requise' })
      await reason(w).setValue('insultes')
      expect(w.find('[data-test="rating-error"]').text()).toBe('Permission RATING_MODERATE requise')
      expect(w.find('[data-test="rating-error"]').attributes('role')).toBe('alert')
      expect((reason(w).element as HTMLTextAreaElement).value).toBe('insultes')
    })

    it('pendant l’envoi : bouton désactivé', async () => {
      const w = mountPanel(rating, { busy: true })
      await reason(w).setValue('insultes')
      expect(confirmBtn(w).attributes('disabled')).toBeDefined()
      expect(confirmBtn(w).attributes('aria-busy')).toBe('true')
    })
  })
})
