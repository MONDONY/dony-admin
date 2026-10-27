import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ModerationDecisionPanel from '@/features/moderation/components/ModerationDecisionPanel.vue'
import { buildQueue } from '@/features/moderation/lib/moderationWorkbench'
import type { ConversationContext } from '@/features/moderation/types/index'
import { seedAuth } from '~/tests/helpers/auth'
import { conversation, message, NOW, participantId, report } from './moderationFixtures'

const UID_A = '11111111-1111-4111-8111-111111111111'
const UID_B = '22222222-2222-4222-8222-222222222222'
const RID = '33333333-3333-4333-8333-333333333333'

const reported = (over = {}) => buildQueue([conversation('c1', { openReportCount: 1, participantAId: UID_A, participantBId: UID_B, ...over })], [report(RID, 'c1')])[0]!
const calm = () => buildQueue([conversation('c2', { participantA: 'Mariam', participantB: 'Ousmane' })], [])[0]!
const reportContext = {
  reporter: { userId: UID_A, displayName: 'Aïcha', totalReports: 3, resolvedReports: 1, dismissedReports: 0 },
  subject: { userId: UID_B, displayName: 'Moussa', accountStatus: 'SUSPENDED', identityVerified: true, reportsReceived: 3, openReportsReceived: 3, cancellationCount: 0 },
}
const convContext = (over: Partial<ConversationContext> = {}): ConversationContext => ({ history: [], notes: [], reports: [], participants: [], ...over })
const mountPanel = (props: Record<string, unknown> = {}) =>
  mount(ModerationDecisionPanel, { props: { conversation: reported(), now: NOW, ...props } })

describe('ModerationDecisionPanel : signalements et message visé', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('sans conversation : rien', () => {
    expect(mountPanel({ conversation: null }).find('[data-test="decision-reports"]').exists()).toBe(false)
  })

  it('signalement lié : motif, signalant, ancienneté, lien vers Signalements', () => {
    const w = mountPanel()
    const card = w.find(`[data-test="decision-report-${RID}"]`)
    expect(card.text()).toContain('Spam')
    expect(card.text()).toContain('par Aïcha')
    expect(card.text()).toContain('Ouvert depuis 4 j')
    expect(w.find(`[data-test="decision-report-link-${RID}"]`).attributes('href')).toBe(`/signalements?open=${RID}`)
    expect(w.text()).toContain('Avertir ou suspendre l’auteur se fait depuis le signalement.')
  })

  it('plusieurs signalements : titre au pluriel', () => {
    const c = buildQueue([conversation('c1', { openReportCount: 2 })], [report(RID, 'c1'), report('44444444-4444-4444-8444-444444444444', 'c1')])[0]!
    expect(mountPanel({ conversation: c }).find('[data-test="decision-reports"]').text()).toContain('Signalements liés')
  })

  it('sans REPORT_VIEW : pas de lien, le signalement reste lisible', () => {
    seedAuth('ADMIN', { REPORT_VIEW: false })
    const w = mountPanel()
    expect(w.find(`[data-test="decision-report-${RID}"]`).exists()).toBe(true)
    expect(w.find(`[data-test="decision-report-link-${RID}"]`).exists()).toBe(false)
  })

  it('compte du serveur sans détail : « N signalements ouverts » et lien vers Signalements', () => {
    const c = buildQueue([conversation('c1', { openReportCount: 3 })], [])[0]!
    const w = mountPanel({ conversation: c })
    expect(w.find('[data-test="decision-reports-count"]').text()).toContain('3 signalements ouverts')
    expect(w.find('[data-test="decision-reports-link"]').attributes('href')).toBe('/signalements')
  })

  it('un seul signalement sans détail : singulier ; sans REPORT_VIEW : pas de lien', () => {
    seedAuth('ADMIN', { REPORT_VIEW: false })
    const c = buildQueue([conversation('c1', { openReportCount: 1 })], [])[0]!
    const w = mountPanel({ conversation: c })
    expect(w.find('[data-test="decision-reports-count"]').text()).toContain('1 signalement ouvert')
    expect(w.find('[data-test="decision-reports-count"]').text()).not.toContain('signalements')
    expect(w.find('[data-test="decision-reports-link"]').exists()).toBe(false)
  })

  it('conversation calme : aucun signalement', () => {
    const w = mountPanel({ conversation: calm() })
    expect(w.find('[data-test="decision-no-report"]').exists()).toBe(true)
    expect(w.find('[data-test="decision-flagged"]').exists()).toBe(false)
  })

  it('message signalé : citation et bouton Supprimer', async () => {
    const w = mountPanel({ flaggedMessage: message('m2', { content: 'Gagnez 500 € vite' }) })
    expect(w.find('[data-test="decision-flagged-quote"]').text()).toBe('« Gagnez 500 € vite »')
    await w.find('[data-test="decision-delete"]').trigger('click')
    expect(w.emitted('delete')![0]).toEqual(['m2'])
  })

  it('citation tronquée à 140 caractères', () => {
    const w = mountPanel({ flaggedMessage: message('m2', { content: 'x'.repeat(200) }) })
    expect(w.find('[data-test="decision-flagged-quote"]').text()).toBe(`« ${'x'.repeat(139)}… »`)
  })

  it('message déjà supprimé : mention, plus de bouton', () => {
    const w = mountPanel({ flaggedMessage: message('m2', { deleted: true, deletedAt: '2026-10-25T15:02:00Z' }) })
    expect(w.find('[data-test="decision-flagged-deleted"]').exists()).toBe(true)
    expect(w.find('[data-test="decision-delete"]').exists()).toBe(false)
  })

  it('sans MESSAGE_DELETE : pas de bouton', () => {
    seedAuth('ADMIN', { MESSAGE_DELETE: false })
    expect(mountPanel({ flaggedMessage: message('m2') }).find('[data-test="decision-delete"]').exists()).toBe(false)
  })

  it('message visé inconnu : pas de carte « Message signalé »', () => {
    expect(mountPanel().find('[data-test="decision-flagged"]').exists()).toBe(false)
  })
})

describe('ModerationDecisionPanel : participants', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('les deux comptes de la liste, avec leur fiche, même sans contexte de signalement', () => {
    const w = mountPanel({ conversation: calm() })
    expect(w.find('[data-test="decision-person-a"]').text()).toContain('Mariam')
    expect(w.find('[data-test="decision-person-b"]').text()).toContain('Ousmane')
    expect(w.find('[data-test="decision-person-link-a"]').attributes('href')).toBe(`/users/${participantId('a', 'c2')}`)
    expect(w.find('[data-test="decision-person-link-b"]').attributes('href')).toBe(`/users/${participantId('b', 'c2')}`)
  })

  it('un identifiant qui n’est pas un UUID ne devient jamais un lien', () => {
    const c = buildQueue([conversation('c7', { participantAId: '../../admin/x' })], [])[0]!
    const w = mountPanel({ conversation: c })
    expect(w.find('[data-test="decision-person-a"]').exists()).toBe(true)
    expect(w.find('[data-test="decision-person-link-a"]').exists()).toBe(false)
  })

  it('avec le contexte du signalement : qui signale, qui est visé, statut du compte et autres signalements', () => {
    const w = mountPanel({ context: reportContext })
    expect(w.find('[data-test="decision-person-a"]').text()).toContain('signale')
    const subject = w.find('[data-test="decision-person-b"]')
    expect(subject.text()).toContain('Moussa')
    expect(subject.text()).toContain('auteur du message')
    expect(subject.text()).toContain('Suspendu')
    expect(subject.text()).toContain('2 autres signalements ouverts')
    expect(w.find('[data-test="decision-person-link-a"]').attributes('href')).toBe(`/users/${UID_A}`)
  })

  it('un seul autre signalement : singulier ; aucun : pas de mention ni de statut', () => {
    const one = { ...reportContext, subject: { ...reportContext.subject, openReportsReceived: 2, accountStatus: 'ACTIVE' } }
    const w = mountPanel({ context: one })
    expect(w.find('[data-test="decision-person-b"]').text()).toContain('1 autre signalement ouvert')
    expect(w.find('[data-test="decision-person-b"]').text()).not.toContain('Suspendu')
    const none = { ...reportContext, subject: { ...reportContext.subject, openReportsReceived: 1 } }
    expect(mountPanel({ context: none }).find('[data-test="decision-person-b"]').text()).not.toContain('autre')
  })

  it('un compte inconnu de la liste : nom « inconnu », pas de lien', () => {
    seedAuth('ADMIN')
    const c = buildQueue([conversation('c9', { participantA: null, participantAId: participantId('a', 'c9'), participantBId: null, participantB: 'Ousmane' })], [])[0]!
    const w = mountPanel({ conversation: c })
    expect(w.find('[data-test="decision-person-a"]').text()).toContain('Nom inconnu')
    expect(w.find('[data-test="decision-person-link-b"]').exists()).toBe(false)
  })

  it('sans USER_VIEW : pas de lien Fiche', () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    const w = mountPanel({ context: reportContext })
    expect(w.find('[data-test="decision-person-link-a"]').exists()).toBe(false)
    expect(w.find('[data-test="decision-person-link-b"]').exists()).toBe(false)
  })

  it('ancien back (pas de comptes dans la liste) : retombe sur les deux personnes du signalement', () => {
    const old = buildQueue([conversation('c1', { openReportCount: 1, participantAId: undefined, participantBId: undefined })], [])[0]!
    const w = mountPanel({ conversation: old, context: { ...reportContext, reporter: { ...reportContext.reporter, displayName: null } } })
    expect(w.find('[data-test="decision-person-reporter"]').text()).toContain('Nom inconnu')
    expect(w.find('[data-test="decision-person-subject"]').text()).toContain('Moussa')
    expect(w.find('[data-test="decision-person-link-subject"]').attributes('href')).toBe(`/users/${UID_B}`)
  })

  it('conversation hors page : un seul nom, pas de « et »', () => {
    const c = { ...calm(), partial: true, participantA: 'Awa ↔ Cheikh', participantAId: null, participantBId: null }
    expect(mountPanel({ conversation: c }).find('[data-test="decision-names"]').text()).toBe('Awa ↔ Cheikh')
  })

  it('sans aucun compte ni contexte : les deux noms de la file', () => {
    const c = buildQueue([conversation('c8', { participantAId: null, participantBId: null })], [])[0]!
    expect(mountPanel({ conversation: c }).find('[data-test="decision-names"]').text()).toBe('Aïcha et Moussa')
  })
})

describe('ModerationDecisionPanel : notes internes et historique', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('ancien back (pas de contexte de conversation) : ni notes ni historique', () => {
    const w = mountPanel()
    expect(w.find('[data-test="decision-notes"]').exists()).toBe(false)
    expect(w.find('[data-test="decision-history"]').exists()).toBe(false)
  })

  it('aucune note, aucun geste : états vides', () => {
    const w = mountPanel({ conversationContext: convContext() })
    expect(w.find('[data-test="decision-notes-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="decision-history-empty"]').text()).toBe('Aucune action de modération.')
  })

  it('liste les notes avec leur auteur (ou « Ancien compte »)', () => {
    const w = mountPanel({ conversationContext: convContext({ notes: [
      { id: 'n1', adminEmail: 'sira@yadony.com', content: 'Même lien dans 2 conversations', createdAt: '2026-10-24T10:00:00' },
      { id: 'n2', adminEmail: null, content: 'Appel passé', createdAt: '2026-10-23T09:00:00' },
    ] }) })
    expect(w.find('[data-test="decision-note-n1"]').text()).toContain('Même lien dans 2 conversations')
    expect(w.find('[data-test="decision-note-n1"]').text()).toContain('sira@yadony.com')
    expect(w.find('[data-test="decision-note-n2"]').text()).toContain('Ancien compte')
  })

  it('historique : gestes du plus ancien au plus récent, avec le motif', () => {
    const w = mountPanel({ conversationContext: convContext({ history: [
      { action: 'MESSAGE_ADMIN_RESTORED', at: '2026-10-25T16:00:00', actorEmail: 'sara@yadony.com', note: 'suppression abusive' },
      { action: 'MESSAGE_ADMIN_DELETED', at: '2026-10-25T15:02:00', actorEmail: 'sara@yadony.com', note: 'propos haineux' },
    ] }) })
    const text = w.find('[data-test="decision-history"]').text()
    expect(text.indexOf('Message supprimé')).toBeLessThan(text.indexOf('Message rétabli'))
    expect(text).toContain('propos haineux')
    expect(text).toContain('suppression abusive')
  })

  it('ajouter une note : bornes de 3 à 1000 caractères, émission du texte nettoyé', async () => {
    const w = mountPanel({ conversationContext: convContext() })
    const add = w.find('[data-test="decision-note-add"]')
    expect((add.element as HTMLButtonElement).disabled).toBe(true)
    await w.find('[data-test="decision-note-input"]').setValue('ab')
    expect(w.find('[data-test="decision-note-problem"]').text()).toContain('3 caractères au moins')
    expect((add.element as HTMLButtonElement).disabled).toBe(true)
    await w.find('[data-test="decision-note-input"]').setValue('  Appel passé, sans réponse  ')
    expect(w.find('[data-test="decision-note-problem"]').exists()).toBe(false)
    await add.trigger('click')
    expect(w.emitted('addNote')![0]).toEqual(['Appel passé, sans réponse'])
  })

  it('une note enregistrée vide la zone ; refusée, elle reste avec le message du serveur', async () => {
    const w = mountPanel({ conversationContext: convContext() })
    const input = w.find('[data-test="decision-note-input"]')
    await input.setValue('Une note valide')
    await w.setProps({ notesBusy: true })
    await w.setProps({ notesBusy: false })
    expect((input.element as HTMLTextAreaElement).value).toBe('')

    await input.setValue('Autre note')
    await w.setProps({ notesBusy: true, notesError: null })
    await w.setProps({ notesBusy: false, notesError: 'Note refusée' })
    expect((input.element as HTMLTextAreaElement).value).toBe('Autre note')
    expect(w.find('[data-test="decision-note-error"]').text()).toBe('Note refusée')
  })

  it('une autre conversation repart sans note en cours', async () => {
    const w = mountPanel({ conversationContext: convContext() })
    await w.find('[data-test="decision-note-input"]').setValue('Brouillon')
    await w.setProps({ conversation: calm() })
    expect((w.find('[data-test="decision-note-input"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('sans MESSAGE_DELETE : notes et historique lisibles, pas de formulaire', () => {
    seedAuth('ADMIN', { MESSAGE_DELETE: false })
    const w = mountPanel({ conversationContext: convContext({ notes: [{ id: 'n1', adminEmail: 'a@b.c', content: 'Note', createdAt: '2026-10-24T10:00:00' }] }) })
    expect(w.find('[data-test="decision-note-n1"]').exists()).toBe(true)
    expect(w.find('[data-test="decision-note-input"]').exists()).toBe(false)
    expect(w.find('[data-test="decision-note-add"]').exists()).toBe(false)
  })
})
