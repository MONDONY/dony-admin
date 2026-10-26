import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import IncidentCase from '@/features/incidents/components/IncidentCase.vue'
import { disputeIncident, noShowIncident } from '@/features/incidents/lib/incidentWorkbench'
import { BID_ID, dispute, disputeDetail, noShow, NuxtLink } from './noShowFixtures'

const NOW = Date.parse('2026-10-26T12:00:00Z')
function mountCase(props: Record<string, unknown>) {
  return mount(IncidentCase, { props: { now: NOW, ...props }, global: { stubs: { NuxtLink } } })
}

describe('IncidentCase : litige', () => {
  beforeEach(() => { seedAuth('ADMIN') })
  const incident = disputeIncident(dispute())

  it('rien de choisi : invitation', () => {
    const w = mountCase({ incident: null })
    expect(w.get('[data-test="incident-case-empty"]').text()).toContain('Sélectionne un incident')
  })

  it('en-tête : motif lisible, phrase, statut, ancienneté et gel du remboursement', () => {
    const w = mountCase({ incident })
    expect(w.get('[data-test="incident-title"]').text()).toBe('Voyageur absent à la livraison')
    expect(w.get('[data-test="incident-sentence"]').text()).toMatch(/à la livraison/)
    expect(w.text()).toContain('Ouvert')
    expect(w.text()).toContain('Remboursement gelé')
    expect(w.get('[data-test="incident-age"]').text()).toBe('8 j')
  })

  it('les parties viennent de la file ; leur fiche n’est liée qu’une fois le dossier chargé', () => {
    const wait = mountCase({ incident, detailLoading: true })
    expect(wait.get('[data-test="incident-party-sender"]').text()).toContain('Koro DIAKITE')
    expect(wait.find('[data-test="incident-party-link-sender"]').exists()).toBe(false)
    expect(wait.get('[data-test="incident-detail-loading"]').exists()).toBe(true)
    const w = mountCase({ incident, detail: disputeDetail() })
    expect(w.get('[data-test="incident-party-link-sender"]').attributes('href')).toBe('/users/11111111-1111-4111-8111-111111111111')
    expect(w.get('[data-test="incident-party-link-traveler"]').attributes('href')).toBe('/users/22222222-2222-4222-8222-222222222222')
  })

  it('une fiche qui n’est pas celle du litige affiché est ignorée', () => {
    const w = mountCase({ incident, detail: disputeDetail({ id: 'autre' }) })
    expect(w.find('[data-test="incident-party-link-sender"]').exists()).toBe(false)
    expect(w.find('[data-test="incident-fact-currency"]').exists()).toBe(false)
  })

  it('colis et paiement : devise, gel, liens du colis et de ses paiements', () => {
    const w = mountCase({ incident, detail: disputeDetail() })
    expect(w.get('[data-test="incident-fact-currency"]').text()).toContain('EUR')
    expect(w.get('[data-test="incident-fact-frozen"]').text()).toContain('Oui')
    expect(w.find('[data-test="incident-fact-resolution"]').exists()).toBe(false)
    expect(w.get('[data-test="incident-bid-link"]').attributes('href')).toBe(`/colis?open=${BID_ID}`)
    expect(w.get('[data-test="incident-payment-link"]').attributes('href')).toBe(`/transactions?bidId=${BID_ID}&view=ALL`)
  })

  it('sans les droits de lecture : du texte à la place des liens', () => {
    seedAuth('SUPPORT', { BID_VIEW: false, PAYMENT_VIEW: false, USER_VIEW: false })
    const w = mountCase({ incident, detail: disputeDetail() })
    expect(w.find('[data-test="incident-bid-link"]').exists()).toBe(false)
    expect(w.get('[data-test="incident-bid-text"]').text()).toContain('Colis 89125c9c')
    expect(w.find('[data-test="incident-payment-link"]').exists()).toBe(false)
    expect(w.find('[data-test="incident-party-link-sender"]').exists()).toBe(false)
  })

  it('litige résolu : résolution, fonds de garantie, partage et chronologie', () => {
    const resolved = disputeIncident(dispute({ status: 'RESOLVED' }))
    const d = disputeDetail({
      status: 'RESOLVED', resolution: 'SPLIT', resolvedAt: '2026-10-24T16:22:00Z', resolutionNote: 'Photos reçues',
      guaranteeAmountCents: 2000, guaranteeCurrency: 'EUR',
      split: { id: 's1', senderRefundAmount: 50, travelerPayoutAmount: 30, currency: 'EUR', mode: 'REFUND_TRANSFER', status: 'SENDER_REFUNDED', attempts: 2, lastError: 'Compte incomplet', stripeRefundId: 'r', stripeTransferId: null, completedAt: null },
    })
    const w = mountCase({ incident: resolved, detail: d })
    expect(w.get('[data-test="incident-fact-resolution"]').text()).toContain('Séquestre partagé')
    expect(w.get('[data-test="incident-fact-guarantee"]').text()).toMatch(/20,00/)
    expect(w.get('[data-test="split-result"]').text()).toContain('Expéditeur : 50 EUR · Voyageur : 30 EUR')
    expect(w.get('[data-test="split-status"]').text()).toContain('versement voyageur à reprendre')
    expect(w.get('[data-test="split-error"]').text()).toContain('2 tentative(s)')
    expect(w.get('[data-test="report-timeline"]').text()).toContain('Photos reçues')
    expect(w.find('[data-test="incident-age"]').exists()).toBe(false)
  })

  it('partage exécuté : pas d’erreur affichée', () => {
    const d = disputeDetail({ split: { id: 's1', senderRefundAmount: 50, travelerPayoutAmount: 30, currency: 'EUR', mode: 'PARTIAL_CAPTURE', status: 'COMPLETED', attempts: 1, lastError: 'ancienne', stripeRefundId: null, stripeTransferId: null, completedAt: 'x' } })
    const w = mountCase({ incident, detail: d })
    expect(w.get('[data-test="split-status"]').text()).toBe('Exécuté')
    expect(w.find('[data-test="split-error"]').exists()).toBe(false)
  })

  it('une erreur de chargement du dossier est dite', () => {
    const w = mountCase({ incident, detailError: 'Impossible de charger le litige' })
    expect(w.get('[data-test="incident-detail-error"]').text()).toBe('Impossible de charger le litige')
    expect(w.find('[data-test="incident-detail-loading"]').exists()).toBe(false)
  })
})

describe('IncidentCase : contexte', () => {
  beforeEach(() => { seedAuth('ADMIN') })
  const incident = disputeIncident(dispute())
  const related = [
    { kind: 'NOSHOW' as const, id: 'n2', type: 'SENDER_NO_SHOW', scope: 'HANDOVER' as const, open: true, createdAt: '2026-10-10T10:00:00' },
    { kind: 'DISPUTE' as const, id: 'd2', type: 'ADMIN_PARCEL_LOST', open: false, createdAt: '2026-09-02T10:00:00' },
  ]

  it('les autres incidents des parties : libellé, nature, état, et ouverture sans quitter l’écran', async () => {
    const w = mountCase({ incident, detail: disputeDetail(), context: { related, history: [] } })
    const list = w.get('[data-test="incident-related"]')
    expect(list.text()).toContain('Déclaration d’absence à la remise')
    expect(list.text()).toContain('Absence')
    expect(list.text()).toContain('À traiter')
    expect(list.text()).toContain('Colis perdu')
    expect(list.text()).toContain('Traité')
    await w.get('[data-test="incident-related-noshow:n2"]').trigger('click')
    await w.get('[data-test="incident-related-dispute:d2"]').trigger('click')
    expect(w.emitted('openIncident')).toEqual([['noshow:n2'], ['dispute:d2']])
  })

  it('pas d’autre incident : pas de section', () => {
    const w = mountCase({ incident, context: { related: [], history: [] } })
    expect(w.find('[data-test="incident-related"]').exists()).toBe(false)
  })

  it('chargement et erreur du contexte', () => {
    expect(mountCase({ incident, contextLoading: true }).find('[data-test="incident-context-loading"]').exists()).toBe(true)
    expect(mountCase({ incident, contextError: 'Contexte indisponible' }).get('[data-test="incident-context-error"]').text()).toBe('Contexte indisponible')
  })

  it('l’historique vient de l’audit quand le contexte est là', () => {
    const w = mountCase({ incident, context: { related: [], history: [{ action: 'RESOLVE', at: '2026-10-24T16:22:00', actorEmail: 'sira@yadony.com', note: 'Preuves' }] } })
    const t = w.get('[data-test="report-timeline"]').text()
    expect(t).toContain('Litige résolu')
    expect(t).toContain('par sira@yadony.com')
    expect(t).toContain('« Preuves »')
  })

  it('le montant du colis s’affiche une fois la fiche chargée', () => {
    const w = mountCase({ incident: disputeIncident(dispute({ amount: 38, currency: 'EUR' })), detail: disputeDetail({ amount: 38 }) })
    expect(w.get('[data-test="incident-fact-amount"]').text()).toContain('38,00 EUR')
    const fromList = mountCase({ incident: disputeIncident(dispute({ amount: 20, currency: 'EUR' })), detail: disputeDetail() })
    expect(fromList.get('[data-test="incident-fact-amount"]').text()).toContain('20,00 EUR')
    expect(mountCase({ incident, detail: disputeDetail() }).find('[data-test="incident-fact-amount"]').exists()).toBe(false)
  })
})

describe('IncidentCase : absence', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('déclaration en attente : phrase, portée, délai de réponse en alerte, parties et faits', () => {
    const w = mountCase({ incident: noShowIncident(noShow({ remainingMinutes: 90, accused: { userId: '33333333-3333-4333-8333-333333333333', name: 'Moussa K.', role: 'SENDER' } })) })
    expect(w.get('[data-test="incident-sentence"]').text()).toMatch(/Awa D\..*Moussa K\./)
    expect(w.text()).toContain('Départ')
    expect(w.get('[data-test="incident-fact-answer"]').text()).toContain('reste 1 h')
    expect(w.get('[data-test="incident-fact-trip"]').text()).toContain('Bamako → Abidjan')
    expect(w.get('[data-test="incident-fact-amount"]').text()).toMatch(/45/)
    expect(w.get('[data-test="incident-party-declarant"]').text()).toContain('Awa D.')
    expect(w.get('[data-test="incident-party-link-accused"]').attributes('href')).toBe('/users/33333333-3333-4333-8333-333333333333')
    expect(w.get('[data-test="report-timeline"]').text()).toContain('Absence déclarée')
  })

  it('litige déjà ouvert : le dossier le propose, sans quitter l’écran', async () => {
    const w = mountCase({ incident: noShowIncident(noShow({ scope: 'DELIVERY', status: 'CONFIRMED', adminDecision: 'CONFIRMED', dispute: { id: 'd1', status: 'OPEN' } })) })
    const link = w.get('[data-test="incident-dispute-link"]')
    expect(link.text()).toContain('Litige ouvert')
    await link.trigger('click')
    expect(w.emitted('openIncident')![0]).toEqual(['dispute:d1'])
  })

  it('litige à venir : l’annonce', () => {
    const w = mountCase({ incident: noShowIncident(noShow({ scope: 'DELIVERY', status: 'CONFIRMED', adminDecision: 'CONFIRMED', dispute: null })) })
    expect(w.get('[data-test="incident-dispute-pending"]').text()).toContain('Un litige va être ouvert')
  })

  it('décision prise : résumé, motif interne et historique', () => {
    const w = mountCase({ incident: noShowIncident(noShow({ status: 'RESOLVED', adminDecision: 'REJECTED', decidedAt: '2026-10-25T10:00:00Z', decisionReason: 'Remise faite, photo' })) })
    expect(w.get('[data-test="noshow-decision"]').text()).toContain('Rejetée')
    expect(w.get('[data-test="noshow-decision-reason"]').text()).toBe('Remise faite, photo')
    expect(w.get('[data-test="report-timeline"]').text()).toContain('« Remise faite, photo »')
  })

  it('ancien back : note d’informations réduites et titre par colis', () => {
    const w = mountCase({ incident: noShowIncident(noShow({ legacy: true, scope: null, declarant: null, accused: null, trip: null, amount: null, paymentMethod: null })) })
    expect(w.get('[data-test="noshow-legacy-note"]').exists()).toBe(true)
    expect(w.find('[data-test="incident-parties"]').exists()).toBe(false)
  })

  it('espèces sans montant : l’état du paiement n’est pas répété', () => {
    const w = mountCase({ incident: noShowIncident(noShow({ amount: null, paymentMethod: 'CASH', commissionStatus: 'PENDING', paymentStatus: 'PENDING' })) })
    expect(w.find('[data-test="incident-fact-payment"]').exists()).toBe(false)
    expect(w.get('[data-test="incident-fact-amount"]').text()).toContain('Espèces')
  })
})
