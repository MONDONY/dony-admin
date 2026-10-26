import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import IncidentDecisionPanel from '@/features/incidents/components/IncidentDecisionPanel.vue'
import { disputeIncident, noShowIncident } from '@/features/incidents/lib/incidentWorkbench'
import type { AdminDisputeSplitOptions } from '@/features/incidents/types/index'
import { dispute, disputeDetail, noShow } from './noShowFixtures'

const options: AdminDisputeSplitOptions = {
  splittable: true, reasonCode: null, currency: 'EUR', amount: 38, commission: 4, refunded: 0, netAvailable: 34, rail: 'STRIPE', paymentStatus: 'ESCROW',
}
const open = disputeIncident(dispute())
const mountPanel = (props: Record<string, unknown> = {}) => mount(IncidentDecisionPanel, { props: { incident: open, detail: disputeDetail(), splitOptions: options, ...props } })
const actionKeys = (w: ReturnType<typeof mountPanel>) => w.findAll('[data-test^="incident-action-"]').map((x) => x.attributes('data-test')!.replace('incident-action-', ''))

describe('IncidentDecisionPanel : litige', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('rien de choisi : invitation, aucun bouton', () => {
    const w = mountPanel({ incident: null })
    expect(w.find('[data-test="incident-decision-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="incident-confirm"]').exists()).toBe(false)
  })

  it('propose les cinq gestes, le premier choisi d’emblée', () => {
    const w = mountPanel()
    expect(actionKeys(w)).toEqual(['RESOLVED_FOR_SENDER', 'RESOLVED_FOR_TRAVELER', 'SPLIT', 'GUARANTEE', 'DISMISSED'])
    expect(w.text()).toContain('Touches 1 à 5')
    expect((w.get('[data-test="incident-action-RESOLVED_FOR_SENDER"] input').element as HTMLInputElement).checked).toBe(true)
  })

  it('le bouton attend une note de 3 caractères, puis envoie la résolution', async () => {
    const w = mountPanel()
    expect(w.get('[data-test="incident-confirm"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="incident-note"]').setValue('ab')
    expect(w.get('[data-test="incident-note-problem"]').text()).toContain('3 caractères')
    await w.get('[data-test="incident-note"]').setValue('Preuves examinées')
    expect(w.get('[data-test="incident-confirm"]').attributes('disabled')).toBeUndefined()
    await w.get('[data-test="incident-confirm"]').trigger('click')
    expect(w.emitted('resolve')![0]).toEqual(['RESOLVED_FOR_SENDER', 'Preuves examinées'])
  })

  it('un motif rapide remplit la note ; classer sans suite émet la bonne résolution', async () => {
    const w = mountPanel()
    await w.get('[data-test="incident-action-DISMISSED"] input').setValue(true)
    await w.get('[data-test="incident-quick-Accord des deux parties"]').trigger('click')
    expect((w.get('[data-test="incident-note"]').element as HTMLTextAreaElement).value).toBe('Accord des deux parties')
    await w.get('[data-test="incident-confirm"]').trigger('click')
    expect(w.emitted('resolve')![0]).toEqual(['DISMISSED', 'Accord des deux parties'])
  })

  it('le bouton annonce le passage au suivant, sauf s’il n’y en a pas', async () => {
    const w = mountPanel()
    expect(w.get('[data-test="incident-confirm"]').text()).toContain('et passer au suivant')
    await w.setProps({ hasNext: false })
    expect(w.get('[data-test="incident-confirm"]').text()).not.toContain('passer au suivant')
  })

  it('partager : le formulaire de partage remplace la note et le bouton principal', async () => {
    const w = mountPanel()
    await w.get('[data-test="incident-action-SPLIT"] input').setValue(true)
    expect(w.find('[data-test="split-form"]').exists()).toBe(true)
    expect(w.find('[data-test="incident-confirm"]').exists()).toBe(false)
    expect(w.find('[data-test="incident-note"]').exists()).toBe(false)
    await w.get('[data-test="split-sender"]').setValue(20)
    await w.get('[data-test="split-traveler"]').setValue(14)
    await w.get('[data-test="split-note"]').setValue('Partage convenu')
    await w.get('[data-test="split-submit"]').trigger('click')
    expect(w.emitted('split')![0]).toEqual([20, 14, 'Partage convenu'])
  })

  it('partager exige la lecture des montants et les deux droits d’argent', () => {
    expect(actionKeys(mountPanel({ splitOptions: null }))).not.toContain('SPLIT')
    seedAuth('SUPPORT', { DISPUTE_RESOLVE: true, PAYMENT_REFUND: false })
    expect(actionKeys(mountPanel())).not.toContain('SPLIT')
  })

  it('fonds de garantie : formulaire avec les parties de la fiche', async () => {
    const w = mountPanel()
    await w.get('[data-test="incident-action-GUARANTEE"] input').setValue(true)
    expect(w.find('[data-test="gf-max"]').exists()).toBe(true)
    await w.get('[data-test="gf-amount"]').setValue('10')
    await w.get('[data-test="gf-beneficiary-sender"]').setValue(true)
    await w.get('[data-test="gf-reason"]').setValue('Colis perdu')
    await w.get('[data-test="gf-submit"]').trigger('click')
    expect(w.emitted('guarantee')![0]).toEqual([1000, '11111111-1111-4111-8111-111111111111', 'Colis perdu'])
  })

  it('une fiche qui n’est pas celle du litige n’alimente pas le fonds de garantie', async () => {
    const w = mountPanel({ detail: disputeDetail({ id: 'autre' }) })
    await w.get('[data-test="incident-action-GUARANTEE"] input').setValue(true)
    expect(w.find('[data-test="gf-no-party"]').exists()).toBe(true)
  })

  it('sans DISPUTE_RESOLVE : aucun geste, un message le dit', () => {
    seedAuth('SUPPORT')
    const w = mountPanel()
    expect(w.find('[data-test="incident-no-action"]').exists()).toBe(true)
    expect(w.find('[data-test="incident-confirm"]').exists()).toBe(false)
  })

  it('refus du back : montré sous le bouton, saisie conservée', async () => {
    const w = mountPanel({ error: 'Litige déjà résolu.' })
    expect(w.get('[data-test="incident-error"]').text()).toBe('Litige déjà résolu.')
    await w.get('[data-test="incident-note"]').setValue('Preuves examinées')
    expect((w.get('[data-test="incident-note"]').element as HTMLTextAreaElement).value).toBe('Preuves examinées')
  })

  it('refus pendant un partage : l’erreur reste visible', async () => {
    const w = mountPanel({ error: 'Partage refusé.' })
    await w.get('[data-test="incident-action-SPLIT"] input').setValue(true)
    expect(w.get('[data-test="incident-error"]').text()).toBe('Partage refusé.')
  })

  it('un autre incident repart de zéro : geste et note', async () => {
    const w = mountPanel()
    await w.get('[data-test="incident-action-DISMISSED"] input').setValue(true)
    await w.get('[data-test="incident-note"]').setValue('Une note')
    await w.setProps({ incident: disputeIncident(dispute({ id: 'd2' })), detail: disputeDetail({ id: 'd2' }) })
    expect((w.get('[data-test="incident-action-RESOLVED_FOR_SENDER"] input').element as HTMLInputElement).checked).toBe(true)
    expect((w.get('[data-test="incident-note"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('raccourcis : pick choisit le geste n, submit confirme', async () => {
    const w = mountPanel()
    ;(w.vm as unknown as { pick: (_n: number) => void }).pick(2)
    await w.get('[data-test="incident-note"]').setValue('Preuves examinées')
    ;(w.vm as unknown as { submit(): void }).submit()
    expect(w.emitted('resolve')![0]).toEqual(['RESOLVED_FOR_TRAVELER', 'Preuves examinées'])
    ;(w.vm as unknown as { pick: (_n: number) => void }).pick(9)
    expect((w.get('[data-test="incident-action-RESOLVED_FOR_TRAVELER"] input').element as HTMLInputElement).checked).toBe(true)
  })

  it('submit sans note valide n’émet rien', () => {
    const w = mountPanel()
    ;(w.vm as unknown as { submit(): void }).submit()
    expect(w.emitted('resolve')).toBeUndefined()
  })

  it('litige résolu : résumé de la décision, note, et pas de nouveau geste', () => {
    const w = mountPanel({ incident: disputeIncident(dispute({ status: 'RESOLVED' })), detail: disputeDetail({ status: 'RESOLVED', resolution: 'DISMISSED', resolutionNote: 'Sans suite' }) })
    expect(w.get('[data-test="incident-decision-done"]').text()).toContain('Classé sans suite')
    expect(w.get('[data-test="incident-decision-done"]').text()).toContain('Sans suite')
    expect(w.find('[data-test="incident-confirm"]').exists()).toBe(false)
    expect(w.find('[data-test="split-retry"]').exists()).toBe(false)
  })

  it('litige résolu sans fiche chargée : libellé par défaut', () => {
    const w = mountPanel({ incident: disputeIncident(dispute({ status: 'RESOLVED' })), detail: null })
    expect(w.get('[data-test="incident-decision-done"]').text()).toContain('Litige résolu')
  })

  it('partage interrompu : reprise proposée aux rôles qui ont les droits', async () => {
    const split = { id: 's1', senderRefundAmount: 50, travelerPayoutAmount: 30, currency: 'EUR', mode: 'REFUND_TRANSFER' as const, status: 'SENDER_REFUNDED' as const, attempts: 2, lastError: 'x', stripeRefundId: 'r', stripeTransferId: null, completedAt: null }
    const props = { incident: disputeIncident(dispute({ status: 'RESOLVED' })), detail: disputeDetail({ status: 'RESOLVED', resolution: 'SPLIT', split }) }
    const w = mountPanel(props)
    await w.get('[data-test="split-retry"]').trigger('click')
    expect(w.emitted('retry-split')).toHaveLength(1)
    seedAuth('SUPPORT', { DISPUTE_RESOLVE: true, PAYMENT_REFUND: false })
    expect(mountPanel(props).find('[data-test="split-retry"]').exists()).toBe(false)
    seedAuth('ADMIN')
    expect(mountPanel({ ...props, detail: disputeDetail({ status: 'RESOLVED', split: { ...split, status: 'COMPLETED' } }) }).find('[data-test="split-retry"]').exists()).toBe(false)
  })
})

describe('IncidentDecisionPanel : absence', () => {
  beforeEach(() => { seedAuth('ADMIN') })
  const incident = noShowIncident(noShow())

  it('confirmer et rejeter, avec leurs conséquences', async () => {
    const w = mountPanel({ incident, detail: null, splitOptions: null })
    expect(actionKeys(w)).toEqual(['NOSHOW_CONFIRM', 'NOSHOW_REJECT'])
    expect(w.get('[data-test="incident-preview"]').text()).toContain('remboursé')
    await w.get('[data-test="incident-action-NOSHOW_REJECT"] input').setValue(true)
    expect(w.get('[data-test="incident-preview"]').text()).toContain('classée')
  })

  it('le motif demande 10 caractères et n’est pas transmis aux parties', async () => {
    const w = mountPanel({ incident, detail: null, splitOptions: null })
    expect(w.text()).toContain('jamais envoyée aux parties')
    await w.get('[data-test="incident-note"]').setValue('court')
    expect(w.get('[data-test="incident-note-problem"]').text()).toContain('10 caractères')
    expect(w.get('[data-test="incident-confirm"]').attributes('disabled')).toBeDefined()
    await w.get('[data-test="incident-quick-Appel au voyageur sans réponse"]').trigger('click')
    await w.get('[data-test="incident-confirm"]').trigger('click')
    expect(w.emitted('decide-noshow')![0]).toEqual(['confirm', 'Appel au voyageur sans réponse'])
  })

  it('rejeter émet le rejet', async () => {
    const w = mountPanel({ incident, detail: null, splitOptions: null })
    await w.get('[data-test="incident-action-NOSHOW_REJECT"] input').setValue(true)
    await w.get('[data-test="incident-note"]').setValue('Remise faite, photo à l’appui')
    await w.get('[data-test="incident-confirm"]').trigger('click')
    expect(w.emitted('decide-noshow')![0]).toEqual(['reject', 'Remise faite, photo à l’appui'])
  })

  it('seule la confirmation si le back n’autorise pas le rejet', () => {
    const w = mountPanel({ incident: noShowIncident(noShow({ canReject: false })), detail: null, splitOptions: null })
    expect(actionKeys(w)).toEqual(['NOSHOW_CONFIRM'])
    expect(w.text()).not.toContain('Touches 1')
  })

  it('ancien back : confirmer sans motif', async () => {
    const w = mountPanel({ incident: noShowIncident(noShow({ legacy: true, scope: null, canReject: false })), detail: null, splitOptions: null })
    expect(w.find('[data-test="incident-note"]').exists()).toBe(false)
    expect(w.get('[data-test="incident-confirm"]').attributes('disabled')).toBeUndefined()
    await w.get('[data-test="incident-confirm"]').trigger('click')
    expect(w.emitted('decide-noshow')![0]).toEqual(['confirm', ''])
  })

  it('aucun geste autorisé : message dédié', () => {
    const w = mountPanel({ incident: noShowIncident(noShow({ canConfirm: false, canReject: false })), detail: null, splitOptions: null })
    expect(w.find('[data-test="incident-no-option"]').exists()).toBe(true)
  })

  it('absence tranchée : décision rappelée, jamais de reprise de partage', () => {
    const w = mountPanel({ incident: noShowIncident(noShow({ status: 'RESOLVED', adminDecision: 'REJECTED', decidedAt: '2026-10-25T10:00:00Z', decisionReason: 'Remise faite' })), detail: null, splitOptions: null })
    expect(w.get('[data-test="incident-decision-done"]').text()).toContain('Rejetée')
    expect(w.get('[data-test="incident-decision-done"]').text()).toContain('Remise faite')
    expect(w.find('[data-test="split-retry"]').exists()).toBe(false)
  })

  it('absence traitée sans décision d’admin (confirmée seule) : libellé de statut', () => {
    const w = mountPanel({ incident: noShowIncident(noShow({ status: 'CONFIRMED', adminDecision: null })), detail: null, splitOptions: null })
    expect(w.get('[data-test="incident-decision-done"]').text()).toBe('Déclaration traitée')
  })

  it('la liste de gestes se recalcule quand les montants arrivent', async () => {
    const w = mountPanel({ splitOptions: null })
    expect(actionKeys(w)).not.toContain('SPLIT')
    await w.setProps({ splitOptions: options })
    expect(actionKeys(w)).toContain('SPLIT')
    await w.get('[data-test="incident-action-SPLIT"] input').setValue(true)
    await w.setProps({ splitOptions: null })
    expect(w.find('[data-test="split-form"]').exists()).toBe(false)
    expect((w.get('[data-test="incident-action-RESOLVED_FOR_SENDER"] input').element as HTMLInputElement).checked).toBe(true)
  })
})
