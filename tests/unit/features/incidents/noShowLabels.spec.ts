import { describe, it, expect } from 'vitest'
import {
  decisionSummary, commissionStatusLabel, disputePending,
  noShowSentence, noShowTitle, shortId, scopeMeta, noShowStatusMeta, remainingMeta, tripLabel, formatDateTime,
  amountLabel, partyLabel, partyRoleLabel, decisionEffect, decisionSuccess, disputeLinkLabel, paymentStatusLabel, bidStatusLabel,
} from '@/features/incidents/components/noShowLabels'
import type { AdminNoShow } from '@/features/incidents/types/index'

const base: AdminNoShow = {
  id: 'c1', bidId: '89125c9c-aaaa-bbbb-cccc-dddddddddddd', legacy: false, scope: 'HANDOVER', reason: 'SENDER_NO_SHOW',
  status: 'PENDING_CONFIRMATION', contestationDeadline: '2026-09-28T15:00:00Z', remainingMinutes: 300, createdAt: '2026-09-28T10:00:00Z',
  declarant: { userId: 't1', name: 'Awa D.', role: 'TRAVELER' }, accused: { userId: 's1', name: 'Moussa K.', role: 'SENDER' },
  trip: { departureCity: 'Bamako', arrivalCity: 'Abidjan', departureDate: '2026-09-15' },
  handoverAt: '2026-09-15T12:30:00Z', amount: 45, currency: 'EUR', paymentMethod: 'CASH', paymentStatus: null, bidStatus: 'ACCEPTED',
  dispute: null, canConfirm: true, canReject: true,
  commissionStatus: null, adminDecision: null, decidedAt: null, decisionReason: null,
}
const row = (over: Partial<AdminNoShow>): AdminNoShow => ({ ...base, ...over })

describe('noShowSentence', () => {
  it('voyageur qui déclare l’expéditeur absent à la remise', () => {
    expect(noShowSentence(base)).toBe('Le voyageur Awa D. déclare l’expéditeur Moussa K. absent à la remise')
  })
  it('voyageur qui déclare le destinataire absent à la livraison', () => {
    expect(noShowSentence(row({ scope: 'DELIVERY', reason: 'RECIPIENT_NO_SHOW', accused: { name: 'Fatou S.', role: 'RECIPIENT' } })))
      .toBe('Le voyageur Awa D. déclare le destinataire Fatou S. absent à la livraison')
  })
  it('expéditeur qui déclare le voyageur absent à la livraison', () => {
    expect(noShowSentence(row({ scope: 'DELIVERY', reason: 'TRAVELER_DELIVERY_NO_SHOW', declarant: { userId: 's1', name: 'Moussa K.', role: 'SENDER' }, accused: { userId: 't1', name: 'Awa D.', role: 'TRAVELER' } })))
      .toBe('L’expéditeur Moussa K. déclare le voyageur Awa D. absent à la livraison')
  })
  it('noms absents : les rôles suffisent', () => {
    expect(noShowSentence(row({ declarant: { role: 'SENDER' }, accused: { role: 'RECIPIENT' } }))).toBe('L’expéditeur déclare le destinataire absent à la remise')
    expect(noShowSentence(row({ declarant: { role: 'RECIPIENT' }, accused: { role: 'TRAVELER', name: '  ' } }))).toBe('Le destinataire déclare le voyageur absent à la remise')
  })
  it('sans déclarant ni mis en cause', () => {
    expect(noShowSentence(row({ declarant: null }))).toBe('Absence déclarée de l’expéditeur Moussa K. à la remise')
    expect(noShowSentence(row({ declarant: null, accused: null }))).toBe('Absence déclarée à la remise')
    expect(noShowSentence(row({ accused: null }))).toBe('Le voyageur Awa D. déclare une absence à la remise')
  })
  it('ancien back : moment déduit du motif', () => {
    expect(noShowSentence(row({ legacy: true, scope: null, declarant: { role: 'TRAVELER' }, accused: { role: 'SENDER' } })))
      .toBe('Le voyageur déclare l’expéditeur absent à la remise')
    expect(noShowSentence(row({ legacy: true, scope: null, reason: 'RECIPIENT_NO_SHOW', declarant: { role: 'TRAVELER' }, accused: { role: 'RECIPIENT' } })))
      .toBe('Le voyageur déclare le destinataire absent à la livraison')
  })
})

describe('titre et identifiants', () => {
  it('nouveau back : la phrase ; ancien back : le colis abrégé, jamais un UUID nu', () => {
    expect(noShowTitle(base)).toBe(noShowSentence(base))
    expect(noShowTitle(row({ legacy: true, scope: null }))).toBe('Colis 89125c9c…')
    expect(shortId('abc')).toBe('abc')
  })
})

describe('badges', () => {
  it('portée', () => {
    expect(scopeMeta('HANDOVER')).toEqual({ label: 'Départ', tone: 'info' })
    expect(scopeMeta('DELIVERY')).toEqual({ label: 'Arrivée', tone: 'warning' })
  })
  it('statut en français, inconnu affiché tel quel', () => {
    expect(noShowStatusMeta('PENDING_CONFIRMATION').label).toBe('En attente')
    expect(noShowStatusMeta('CONTESTED').label).toBe('Contesté')
    expect(noShowStatusMeta('CONFIRMED').label).toBe('Absence confirmée')
    expect(noShowStatusMeta('RESOLVED').label).toBe('Résolu')
    expect(noShowStatusMeta('BIZARRE' as never)).toEqual({ label: 'BIZARRE', tone: 'neutral' })
  })
  it('lien de litige', () => {
    expect(disputeLinkLabel({ id: 'd1', status: 'OPEN' })).toBe('Litige ouvert')
    expect(disputeLinkLabel({ id: 'd1', status: 'RESOLVED' })).toBe('Litige résolu')
    expect(disputeLinkLabel({ id: 'd1', status: 'X' })).toBe('Litige lié')
  })
})

describe('remainingMeta', () => {
  const now = Date.parse('2026-09-28T10:00:00Z')
  it('heures, minutes, jours ; rouge sous 2 h', () => {
    expect(remainingMeta(base, now)).toEqual({ label: 'reste 5 h', urgent: false })
    expect(remainingMeta(row({ remainingMinutes: 90 }), now)).toEqual({ label: 'reste 1 h', urgent: true })
    expect(remainingMeta(row({ remainingMinutes: 45 }), now)).toEqual({ label: 'reste 45 min', urgent: true })
    expect(remainingMeta(row({ remainingMinutes: 3 * 1440 + 10 }), now)).toEqual({ label: 'reste 3 j', urgent: false })
  })
  it('échu à zéro ou moins', () => {
    expect(remainingMeta(row({ remainingMinutes: 0 }), now)).toEqual({ label: 'échu', urgent: true })
    expect(remainingMeta(row({ remainingMinutes: -30 }), now)).toEqual({ label: 'échu', urgent: true })
  })
  it('calculé depuis l’échéance quand le back ne donne pas les minutes', () => {
    expect(remainingMeta(row({ remainingMinutes: null }), now)).toEqual({ label: 'reste 5 h', urgent: false })
    expect(remainingMeta(row({ remainingMinutes: null, contestationDeadline: '2026-09-28T09:00:00Z' }), now)).toEqual({ label: 'échu', urgent: true })
  })
  it('rien quand la déclaration n’attend plus de réponse ou n’a pas d’échéance', () => {
    expect(remainingMeta(row({ status: 'CONFIRMED' }), now)).toBeNull()
    expect(remainingMeta(row({ remainingMinutes: null, contestationDeadline: null }), now)).toBeNull()
    expect(remainingMeta(row({ remainingMinutes: null, contestationDeadline: 'pas une date' }), now)).toBeNull()
  })
  it('utilise l’heure courante par défaut', () => {
    expect(remainingMeta(row({ remainingMinutes: null, contestationDeadline: '2000-01-01T00:00:00Z' }))?.label).toBe('échu')
  })
})

describe('trajet, dates, montant', () => {
  it('trajet lisible', () => {
    expect(tripLabel(base.trip)).toBe('Bamako → Abidjan, 15 sept.')
    expect(tripLabel({ departureCity: 'Paris', arrivalCity: 'Dakar' })).toBe('Paris → Dakar')
    expect(tripLabel({ departureCity: 'Paris' })).toBe('Paris → ?')
    expect(tripLabel(null)).toBeNull()
    expect(tripLabel({})).toBeNull()
  })
  it('date et heure', () => {
    expect(formatDateTime('2026-09-15T12:30:00Z')).toBe('15 sept. à 14:30')
    expect(formatDateTime(null)).toBeNull()
    expect(formatDateTime('nope')).toBeNull()
  })
  it('montant et mode de paiement', () => {
    expect(amountLabel(base)).toMatch(/^45,00 EUR · Espèces$/)
    expect(amountLabel(row({ paymentMethod: 'STRIPE' }))).toMatch(/Carte$/)
    expect(amountLabel(row({ paymentMethod: null }))).toMatch(/^45,00 EUR$/)
    expect(amountLabel(row({ amount: null }))).toBe('Espèces')
    expect(amountLabel(row({ amount: null, paymentMethod: null }))).toBeNull()
  })
  it('états du paiement et du colis', () => {
    expect(paymentStatusLabel(null)).toBeNull()
    expect(paymentStatusLabel('REFUNDED')).toBe('Remboursé')
    expect(paymentStatusLabel('INCONNU')).toBe('INCONNU')
    expect(bidStatusLabel('ACCEPTED')).toBe('Accepté')
    expect(bidStatusLabel('INCONNU')).toBe('INCONNU')
    expect(bidStatusLabel(null)).toBeNull()
  })
})

describe('parties', () => {
  it('libellés', () => {
    expect(partyRoleLabel('SENDER')).toBe('Expéditeur')
    expect(partyRoleLabel('TRAVELER')).toBe('Voyageur')
    expect(partyRoleLabel('RECIPIENT')).toBe('Destinataire')
    expect(partyLabel({ role: 'TRAVELER', name: 'Awa D.' })).toBe('Awa D.')
    expect(partyLabel({ role: 'RECIPIENT' })).toBe('Nom inconnu')
  })
})

describe('effets d’une décision', () => {
  it('confirmer au départ : annulation et remboursement, commission rendue si espèces', () => {
    const lines = decisionEffect(base, 'confirm')
    expect(lines.join(' ')).toMatch(/colis est annulé et l’expéditeur remboursé/)
    expect(lines.join(' ')).toMatch(/commission est remboursée au voyageur/)
    expect(lines.join(' ')).toMatch(/sans le motif interne/)
    expect(decisionEffect(row({ paymentMethod: 'STRIPE' }), 'confirm').join(' ')).not.toMatch(/commission/)
  })
  it('confirmer à l’arrivée : un litige est ouvert', () => {
    expect(decisionEffect(row({ scope: 'DELIVERY' }), 'confirm').join(' ')).toMatch(/litige est ouvert.*onglet Litiges/)
  })
  it('rejeter : la déclaration est classée', () => {
    expect(decisionEffect(base, 'reject').join(' ')).toMatch(/déclaration est classée et le colis continue normalement/)
  })
  it('ancien back : confirmation de l’absence de l’expéditeur', () => {
    expect(decisionEffect(row({ legacy: true, scope: null }), 'confirm').join(' ')).toMatch(/serveur n’est pas encore à jour/)
  })
  it('messages de succès', () => {
    expect(decisionSuccess(base, 'confirm')).toMatch(/Absence confirmée.*remboursé/)
    expect(decisionSuccess(row({ scope: 'DELIVERY' }), 'confirm')).toMatch(/Litige ouvert/)
    expect(decisionSuccess(base, 'reject')).toMatch(/Déclaration rejetée/)
    expect(decisionSuccess(row({ legacy: true, scope: null }), 'confirm')).toBe('Absence confirmée.')
  })
  it('aucun tiret cadratin affiché', () => {
    const all = [noShowSentence(base), ...decisionEffect(base, 'confirm'), ...decisionEffect(row({ scope: 'DELIVERY' }), 'confirm'), ...decisionEffect(base, 'reject'), decisionSuccess(base, 'confirm')]
    expect(all.join(' ')).not.toContain('—')
  })
})

describe('décision de l’administrateur (back #345)', () => {
  it('libellé : « Rejetée » ou « Absence confirmée » selon adminDecision', () => {
    expect(noShowStatusMeta('RESOLVED', 'REJECTED')).toEqual({ label: 'Rejetée', tone: 'neutral' })
    expect(noShowStatusMeta('CONFIRMED', 'CONFIRMED').label).toBe('Absence confirmée')
    expect(noShowStatusMeta('RESOLVED', null).label).toBe('Résolu')
  })
  it('résumé daté de la décision', () => {
    expect(decisionSummary(row({ adminDecision: 'REJECTED', decidedAt: '2026-09-28T10:00:00Z' }))).toBe('Rejetée le 28 sept. à 12:00')
    expect(decisionSummary(row({ adminDecision: 'CONFIRMED', decidedAt: null }))).toBe('Absence confirmée')
    expect(decisionSummary(base)).toBeNull()
  })
  it('espèces sans montant : « Espèces » et statut de commission', () => {
    expect(amountLabel(row({ amount: null, commissionStatus: 'CHARGED' }))).toBe('Espèces · commission prélevée')
    expect(amountLabel(row({ amount: null, paymentMethod: null, commissionStatus: 'PENDING' }))).toBe('Espèces · commission en attente')
    expect(commissionStatusLabel('REFUNDED')).toBe('commission remboursée')
    expect(commissionStatusLabel('REQUIRES_3DS')).toBe('commission en attente de validation')
    expect(commissionStatusLabel('FAILED')).toBe('commission non prélevée')
    expect(commissionStatusLabel('REFUND_FAILED')).toBe('remboursement de la commission échoué')
    expect(commissionStatusLabel('AUTRE')).toBe('commission : AUTRE')
    expect(commissionStatusLabel(null)).toBeNull()
  })
  it('litige en cours de création après une confirmation à l’arrivée', () => {
    expect(disputePending(row({ scope: 'DELIVERY', adminDecision: 'CONFIRMED', dispute: null }))).toBe(true)
    expect(disputePending(row({ scope: 'DELIVERY', adminDecision: 'CONFIRMED', dispute: { id: 'd1', status: 'OPEN' } }))).toBe(false)
    expect(disputePending(row({ scope: 'HANDOVER', adminDecision: 'CONFIRMED' }))).toBe(false)
    expect(disputePending(row({ scope: 'DELIVERY', adminDecision: 'REJECTED' }))).toBe(false)
  })
  it('succès à l’arrivée sans litige encore créé', () => {
    expect(decisionSuccess(row({ scope: 'DELIVERY' }), 'confirm', true)).toMatch(/Un litige va être ouvert/)
  })
})
