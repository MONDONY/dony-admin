import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import SupportContextPanel from '@/features/support/components/SupportContextPanel.vue'
import { ticket } from './supportFixtures'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to"><slot /></a>' }
const UID = '11111111-1111-4111-8111-111111111111'
function mountPanel(props: Record<string, unknown> = {}) {
  return mount(SupportContextPanel, { props: { ticket: ticket({ userId: UID }), ...props }, global: { stubs: { NuxtLink } } })
}
// seedAuth pose l'administrateur « u1 ».
const mine = (over = {}) => ticket({ userId: UID, assignedAdminId: 'u1', assignedAdminEmail: 'admin@yadony.com', status: 'WAITING_SUPPORT', ...over })
const user = (over = {}) => ({ id: UID, status: 'ACTIVE', kycStatus: 'VERIFIED', createdAt: '2026-08-12T10:00:00Z', ...over }) as never

describe('SupportContextPanel', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('rien de choisi : invitation', () => {
    expect(mountPanel({ ticket: null }).get('[data-test="support-context-empty"]').exists()).toBe(true)
  })

  it('utilisateur : nom, identité, ancienneté du compte et liens vers sa fiche, ses colis, ses paiements', () => {
    const w = mountPanel({ user: user() })
    expect(w.get('[data-test="support-user-name"]').text()).toBe('user D')
    expect(w.get('[data-test="support-user-facts"]').text()).toBe('Identité vérifiée · Membre depuis août 2026')
    expect(w.get('[data-test="support-user-link"]').attributes('href')).toBe(`/users/${UID}`)
    expect(w.get('[data-test="support-user-parcels"]').attributes('href')).toBe(`/users/${UID}?tab=parcels`)
    expect(w.get('[data-test="support-user-money"]').attributes('href')).toBe(`/users/${UID}?tab=money`)
    expect(w.find('[data-test="support-user-account"]').exists()).toBe(false)
  })

  it('compte suspendu, identité non vérifiée', () => {
    const w = mountPanel({ user: user({ status: 'SUSPENDED', kycStatus: 'PENDING' }) })
    expect(w.get('[data-test="support-user-account"]').text()).toBe('Compte suspendu')
    expect(w.get('[data-test="support-user-facts"]').text()).toContain('Identité non vérifiée')
  })

  it('sans fiche (droit manquant ou chargement) : le nom seul ; sans USER_VIEW : pas de liens', () => {
    expect(mountPanel().find('[data-test="support-user-facts"]').exists()).toBe(false)
    seedAuth('SUPPORT', { USER_VIEW: false })
    const w = mountPanel()
    expect(w.find('[data-test="support-user-links"]').exists()).toBe(false)
    expect(w.get('[data-test="support-user-name"]').text()).toBe('user D')
  })

  it('identifiant d’utilisateur invalide : pas de lien', () => {
    expect(mountPanel({ ticket: ticket({ userId: 'u1' }) }).find('[data-test="support-user-links"]').exists()).toBe(false)
  })

  describe('actions', () => {
    it('non assigné : « M’assigner »', async () => {
      const w = mountPanel()
      await w.get('[data-test="support-action-assign"]').trigger('click')
      expect(w.emitted('assign')![0]).toEqual(['t1'])
      expect(w.find('[data-test="support-action-resolve"]').exists()).toBe(false)
    })

    it('assigné à un collègue : « Reprendre », avec le message d’exclusivité', async () => {
      const w = mountPanel({ ticket: ticket({ userId: UID, assignedAdminId: 'x', assignedAdminEmail: 'x@yadony.com' }) })
      await w.get('[data-test="support-action-reassign"]').trigger('click')
      expect(w.emitted('reassign')![0]).toEqual(['t1', 'u1'])
      expect(w.text()).toContain('réservés à la personne assignée')
    })

    it('à moi : résolution en deux temps, définitive, annulable', async () => {
      const w = mountPanel({ ticket: mine() })
      expect(w.get('[data-test="support-resolve-hint"]').text()).toContain('Définitif')
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      expect(w.emitted('resolve')).toBeUndefined()
      expect(w.get('[data-test="support-action-resolve"]').text()).toBe('Confirmer : résoudre ce ticket')
      await w.get('[data-test="support-action-cancel"]').trigger('click')
      expect(w.get('[data-test="support-action-resolve"]').text()).toBe('Marquer résolu')
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      expect(w.emitted('resolve')![0]).toEqual(['t1'])
    })

    it('un autre ticket repart sans confirmation en attente', async () => {
      const w = mountPanel({ ticket: mine() })
      await w.get('[data-test="support-action-resolve"]').trigger('click')
      await w.setProps({ ticket: mine({ id: 't2' }) })
      expect(w.get('[data-test="support-action-resolve"]').text()).toBe('Marquer résolu')
    })

    it('ticket résolu ou sans SUPPORT_TICKET_MANAGE : aucune action', () => {
      expect(mountPanel({ ticket: mine({ status: 'RESOLVED' }) }).find('[data-test="support-actions"]').exists()).toBe(false)
      seedAuth('SUPPORT', { SUPPORT_TICKET_MANAGE: false })
      expect(mountPanel().find('[data-test="support-actions"]').exists()).toBe(false)
    })

    it('refus du back : montré, avec ou sans bloc d’actions', () => {
      expect(mountPanel({ ticket: mine(), actionError: 'Ticket déjà pris.' }).get('[data-test="support-action-error"]').text()).toBe('Ticket déjà pris.')
      expect(mountPanel({ ticket: mine({ status: 'RESOLVED' }), actionError: 'Déjà résolu.' }).get('[data-test="support-action-error"]').text()).toBe('Déjà résolu.')
    })

    it('action en cours : boutons inactifs', () => {
      expect(mountPanel({ acting: true }).get('[data-test="support-action-assign"]').attributes('disabled')).toBeDefined()
    })
  })

  describe('priorité et notes (serveur à jour)', () => {
    const context = { history: [], notes: [{ id: 'n1', adminEmail: 'sira@yadony.com', content: 'Appel passé, sans réponse', createdAt: '2026-10-25T10:00:00' }] }

    it('sans contexte (ancien back) : ni priorité ni notes', () => {
      const w = mountPanel({ ticket: mine() })
      expect(w.find('[data-test="support-priority"]').exists()).toBe(false)
      expect(w.find('[data-test="support-notes"]').exists()).toBe(false)
    })

    it('priorité : quatre choix, celle du ticket marquée, un clic sur une autre l’envoie', async () => {
      const w = mountPanel({ ticket: mine({ priority: 'HIGH' }), context })
      expect(w.findAll('button[data-test^="support-priority-"]').map((b) => b.attributes('data-test'))).toEqual([
        'support-priority-URGENT', 'support-priority-HIGH', 'support-priority-NORMAL', 'support-priority-LOW',
      ])
      expect(w.get('[data-test="support-priority-HIGH"]').attributes('aria-pressed')).toBe('true')
      await w.get('[data-test="support-priority-HIGH"]').trigger('click')
      expect(w.emitted('set-priority')).toBeUndefined()
      await w.get('[data-test="support-priority-URGENT"]').trigger('click')
      expect(w.emitted('set-priority')![0]).toEqual(['t1', 'URGENT'])
    })

    it('priorité masquée sur un ticket résolu ou sans le droit de gérer', () => {
      expect(mountPanel({ ticket: mine({ status: 'RESOLVED' }), context }).find('[data-test="support-priority"]').exists()).toBe(false)
      seedAuth('SUPPORT', { SUPPORT_TICKET_MANAGE: false })
      const w = mountPanel({ context })
      expect(w.find('[data-test="support-priority"]').exists()).toBe(false)
      expect(w.find('[data-test="support-note-input"]').exists()).toBe(false)
    })

    it('notes : celles du ticket avec leur auteur, ou « Aucune note »', () => {
      const w = mountPanel({ ticket: mine(), context })
      expect(w.get('[data-test="support-note-n1"]').text()).toContain('Appel passé, sans réponse')
      expect(w.get('[data-test="support-note-n1"]').text()).toContain('sira@yadony.com')
      expect(w.get('[data-test="support-notes"]').text()).toContain('jamais de l’utilisateur')
      expect(mountPanel({ ticket: mine(), context: { history: [], notes: [{ ...context.notes[0]!, adminEmail: null }] } }).get('[data-test="support-note-n1"]').text()).toContain('Ancien compte')
      expect(mountPanel({ ticket: mine(), context: { history: [], notes: [] } }).get('[data-test="support-notes-empty"]').exists()).toBe(true)
    })

    it('ajouter une note : 3 caractères au moins, envoyée nettoyée', async () => {
      const w = mountPanel({ ticket: mine(), context })
      expect(w.get('[data-test="support-note-add"]').attributes('disabled')).toBeDefined()
      await w.get('[data-test="support-note-input"]').setValue('ab')
      expect(w.get('[data-test="support-note-problem"]').text()).toContain('3 caractères')
      expect(w.get('[data-test="support-note-add"]').attributes('disabled')).toBeDefined()
      await w.get('[data-test="support-note-input"]').setValue('  À rappeler demain  ')
      await w.get('[data-test="support-note-add"]').trigger('click')
      expect(w.emitted('add-note')![0]).toEqual(['t1', 'À rappeler demain'])
    })

    it('note enregistrée : la zone se vide ; refusée : elle reste, avec la phrase', async () => {
      const w = mountPanel({ ticket: mine(), context })
      await w.get('[data-test="support-note-input"]').setValue('À rappeler demain')
      await w.setProps({ notesBusy: true })
      expect(w.get('[data-test="support-note-add"]').attributes('disabled')).toBeDefined()
      await w.setProps({ notesBusy: false })
      expect((w.get('[data-test="support-note-input"]').element as HTMLTextAreaElement).value).toBe('')

      await w.get('[data-test="support-note-input"]').setValue('Note refusée')
      await w.setProps({ notesBusy: true })
      await w.setProps({ notesError: 'La note doit faire entre 3 et 1000 caractères', notesBusy: false })
      expect((w.get('[data-test="support-note-input"]').element as HTMLTextAreaElement).value).toBe('Note refusée')
      expect(w.get('[data-test="support-note-error"]').text()).toContain('entre 3 et 1000')
    })

    it('un autre ticket repart d’une zone de note vide', async () => {
      const w = mountPanel({ ticket: mine(), context })
      await w.get('[data-test="support-note-input"]').setValue('Brouillon de note')
      await w.setProps({ ticket: mine({ id: 't2' }) })
      expect((w.get('[data-test="support-note-input"]').element as HTMLTextAreaElement).value).toBe('')
    })

    it('historique tiré de l’audit quand le contexte est là', () => {
      const w = mountPanel({ ticket: mine(), context: { history: [{ action: 'SUPPORT_TICKET_PRIORITY_CHANGED', detail: 'HIGH', at: '2026-10-25T09:00:00', actorEmail: 'sira@yadony.com' }], notes: [] } })
      const t = w.get('[data-test="report-timeline"]').text()
      expect(t).toContain('Priorité haute')
      expect(t).toContain('par sira@yadony.com')
    })
  })

  it('autres conversations : état, ouverture sans quitter l’écran, ou « aucune »', async () => {
    const w = mountPanel({ related: [ticket({ id: 't9', subject: 'Et si mon colis se fait voler', status: 'WAITING_USER' })] })
    expect(w.get('[data-test="support-related-t9"]').text()).toContain('Et si mon colis se fait voler')
    expect(w.get('[data-test="support-related-t9"]').text()).toContain('Attente utilisateur')
    await w.get('[data-test="support-related-t9"]').trigger('click')
    expect(w.emitted('openTicket')![0]).toEqual(['t9'])
    expect(mountPanel().get('[data-test="support-related-empty"]').exists()).toBe(true)
  })

  it('historique : ouverture, assignation, résolution', () => {
    const w = mountPanel({ ticket: mine({ status: 'RESOLVED', resolvedAt: '2026-10-24T10:12:00Z' }) })
    const t = w.get('[data-test="report-timeline"]').text()
    expect(t).toContain('Ticket ouvert')
    expect(t).toContain('Assigné à admin@yadony.com')
    expect(t).toContain('Résolu')
  })
})
