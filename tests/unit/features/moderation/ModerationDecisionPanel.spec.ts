import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ModerationDecisionPanel from '@/features/moderation/components/ModerationDecisionPanel.vue'
import { buildQueue } from '@/features/moderation/lib/moderationWorkbench'
import { seedAuth } from '~/tests/helpers/auth'
import { conversation, message, NOW, queue, report } from './moderationFixtures'

const UID_REPORTER = '11111111-1111-4111-8111-111111111111'
const UID_SUBJECT = '22222222-2222-4222-8222-222222222222'
const RID = '33333333-3333-4333-8333-333333333333'

const reported = () => buildQueue([conversation('c1')], [report(RID, 'c1')])[0]!
const calm = () => queue()[1]!
const context = {
  reporter: { userId: UID_REPORTER, displayName: 'Aïcha', totalReports: 3, resolvedReports: 1, dismissedReports: 0 },
  subject: { userId: UID_SUBJECT, displayName: 'Moussa', accountStatus: 'SUSPENDED', identityVerified: true, reportsReceived: 3, openReportsReceived: 3, cancellationCount: 0 },
}
const mountPanel = (props: Record<string, unknown> = {}) =>
  mount(ModerationDecisionPanel, { props: { conversation: reported(), now: NOW, ...props } })

describe('ModerationDecisionPanel', () => {
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
    const c = buildQueue([conversation('c1')], [report(RID, 'c1'), report('44444444-4444-4444-8444-444444444444', 'c1')])[0]!
    expect(mountPanel({ conversation: c }).find('[data-test="decision-reports"]').text()).toContain('Signalements liés')
  })

  it('sans REPORT_VIEW : pas de lien, le signalement reste lisible', () => {
    seedAuth('ADMIN', { REPORT_VIEW: false })
    const w = mountPanel()
    expect(w.find(`[data-test="decision-report-${RID}"]`).exists()).toBe(true)
    expect(w.find(`[data-test="decision-report-link-${RID}"]`).exists()).toBe(false)
  })

  it('conversation calme : aucun signalement, noms seuls', () => {
    const w = mountPanel({ conversation: calm() })
    expect(w.find('[data-test="decision-no-report"]').exists()).toBe(true)
    expect(w.find('[data-test="decision-flagged"]').exists()).toBe(false)
    expect(w.find('[data-test="decision-names"]').text()).toBe('Mariam et Ousmane')
  })

  it('conversation hors page : un seul nom, pas de « et »', () => {
    const c = buildQueue([], [report(RID, 'old', { targetLabel: 'Awa ↔ Cheikh' })])[0]!
    expect(mountPanel({ conversation: c }).find('[data-test="decision-names"]').text()).toBe('Awa ↔ Cheikh')
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

  it('participants du contexte : fiches, statut du compte et autres signalements', () => {
    const w = mountPanel({ context })
    expect(w.find('[data-test="decision-person-reporter"]').text()).toContain('Aïcha')
    expect(w.find('[data-test="decision-person-link-reporter"]').attributes('href')).toBe(`/users/${UID_REPORTER}`)
    const subject = w.find('[data-test="decision-person-subject"]')
    expect(subject.text()).toContain('Moussa')
    expect(subject.text()).toContain('Suspendu')
    expect(subject.text()).toContain('2 autres signalements ouverts')
    expect(w.find('[data-test="decision-names"]').exists()).toBe(false)
  })

  it('un seul autre signalement : singulier ; aucun : pas de mention', () => {
    const one = { ...context, subject: { ...context.subject, openReportsReceived: 2, accountStatus: 'ACTIVE' } }
    const w = mountPanel({ context: one })
    expect(w.find('[data-test="decision-person-subject"]').text()).toContain('1 autre signalement ouvert')
    expect(w.find('[data-test="decision-person-subject"]').text()).not.toContain('Suspendu')
    const none = { ...context, subject: { ...context.subject, openReportsReceived: 1 } }
    expect(mountPanel({ context: none }).find('[data-test="decision-person-subject"]').text()).not.toContain('autre')
  })

  it('sans USER_VIEW : pas de lien Fiche ; nom absent : « Nom inconnu »', () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    const w = mountPanel({ context: { reporter: { ...context.reporter, displayName: null }, subject: context.subject } })
    expect(w.find('[data-test="decision-person-link-reporter"]').exists()).toBe(false)
    expect(w.find('[data-test="decision-person-reporter"]').text()).toContain('Nom inconnu')
  })
})
