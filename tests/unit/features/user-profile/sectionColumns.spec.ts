import { describe, it, expect } from 'vitest'
import {
  auditColumns, cancellationColumns, disputeColumns, disputeLink, humanize, parcelColumns, parcelLink, paymentColumns,
  paymentLink, ratingColumns, reportColumns, reportLink, requestColumns, requestLink, roleLabel, tripColumns, tripLink,
} from '@/features/user-profile/lib/sectionColumns'
import { formatInstant } from '@/features/user-profile/lib/formatInstant'

const col = (cols: ReturnType<() => typeof parcelColumns>, key: string) => cols.find(c => c.key === key)!
const txt = (cols: typeof parcelColumns, key: string, row: unknown) => {
  const c = col(cols, key)
  return c.format ? c.format(row) : String((row as Record<string, unknown>)[key])
}

describe('sectionColumns', () => {
  it('humanize et rôles : valeur inconnue = brute / lisible, jamais vide', () => {
    expect(humanize('SOME_CODE')).toBe('Some code')
    expect(humanize(null)).toBe('—')
    expect(roleLabel('PAYER')).toBe('Payeur')
    expect(roleLabel('BENEFICIARY')).toBe('Bénéficiaire')
    expect(roleLabel('REPORTER')).toBe('Déclarant')
    expect(roleLabel('WEIRD')).toBe('WEIRD')
    expect(roleLabel(null)).toBe('—')
  })

  it('formatInstant : Europe/Paris, tiret si absent ou invalide', () => {
    expect(formatInstant('2026-10-20T23:30:00Z')).toContain('21/10/2026')
    expect(formatInstant(null)).toBe('—')
    expect(formatInstant('pas une date')).toBe('—')
  })

  it('colis : référence, montant formaté, montant nul = tiret, statut inconnu = texte', () => {
    const r = { id: 'abcdef123', trackingNumber: null, corridor: 'Paris → Dakar', role: 'SENDER', status: 'IN_TRANSIT', createdAt: '2026-10-20T10:00:00Z', deliveredAt: null, amount: { currency: 'XOF', amountCents: 600000 }, announcementId: null }
    expect(txt(parcelColumns, 'trackingNumber', r)).toBe('abcdef12')
    expect(txt(parcelColumns, 'amount', r)).toContain('6 000,00 XOF')
    expect(txt(parcelColumns, 'amount', { ...r, amount: null })).toBe('—')
    expect(txt(parcelColumns, 'deliveredAt', r)).toBe('—')
    expect(txt(parcelColumns, 'status', r)).toBe('En transit')
    expect(col(parcelColumns, 'status').tone!(r)).toBe('info')
    expect(txt(parcelColumns, 'status', { ...r, status: 'NEW_ONE' })).toBe('NEW_ONE')
    expect(col(parcelColumns, 'status').tone!({ ...r, status: 'NEW_ONE' })).toBe('neutral')
    expect(txt(parcelColumns, 'status', { ...r, status: null })).toBe('—')
    expect(txt(parcelColumns, 'trackingNumber', { ...r, trackingNumber: 'DNY-1' })).toBe('DNY-1')
  })

  it('trajets : jour de départ en UTC, prix, étapes', () => {
    const r = { id: 't', status: 'ACTIVE', corridor: 'A → B', departureDate: '2026-10-25', availableKg: 12, pricePerKg: 8.5, currency: 'EUR', tripLegIndex: 0, tripLegCount: 2 }
    expect(txt(tripColumns, 'departureDate', r)).toBe('25/10/2026')
    expect(txt(tripColumns, 'availableKg', r)).toBe('12 kg')
    expect(txt(tripColumns, 'pricePerKg', r)).toBe('8,5 EUR')
    expect(txt(tripColumns, 'pricePerKg', { ...r, currency: null })).toBe('8,5')
    expect(txt(tripColumns, 'tripLegIndex', r)).toBe('1 sur 2')
    expect(txt(tripColumns, 'tripLegIndex', { ...r, tripLegCount: null })).toBe('—')
    expect(txt(tripColumns, 'status', r)).toBeTruthy()
  })

  it('demandes : date souhaitée = jour UTC, poids absent = tiret, statut inconnu humanisé', () => {
    const r = { id: 'q', corridor: 'A → B', status: 'OPEN', weightKg: null, desiredDate: '2026-10-25T00:00:00Z', createdAt: '2026-10-20T10:00:00Z', openNegotiationCount: 3 }
    expect(txt(requestColumns, 'desiredDate', r)).toBe('25/10/2026')
    expect(txt(requestColumns, 'desiredDate', { ...r, desiredDate: null })).toBe('—')
    expect(txt(requestColumns, 'weightKg', r)).toBe('—')
    expect(txt(requestColumns, 'weightKg', { ...r, weightKg: 4 })).toBe('4 kg')
    expect(txt(requestColumns, 'openNegotiationCount', r)).toBe('3')
    expect(txt(requestColumns, 'status', r)).toBe('Ouverte')
    expect(txt(requestColumns, 'status', { ...r, status: 'ON_HOLD' })).toBe('On hold')
    expect(txt(requestColumns, 'createdAt', r)).toContain('20/10/2026')
  })

  it('paiements : montants via formatAmount, XOF compris, versement retenu en texte', () => {
    const r = { id: 'p', bidId: 'b', status: 'ESCROW', method: 'PAWAPAY', amountCents: 600000, commissionCents: 72000, currency: 'XOF', createdAt: '2026-10-20T10:00:00Z', payoutHeldAt: '2026-10-21T10:00:00Z', beneficiaryHeld: true, role: 'PAYER' }
    expect(txt(paymentColumns, 'amountCents', r)).toContain('6 000,00 XOF')
    expect(txt(paymentColumns, 'commissionCents', r)).toContain('720,00 XOF')
    expect(txt(paymentColumns, 'method', r)).toBe('Mobile money')
    expect(txt(paymentColumns, 'method', { ...r, method: 'X' })).toBe('X')
    expect(txt(paymentColumns, 'method', { ...r, method: null })).toBe('—')
    expect(txt(paymentColumns, 'role', r)).toBe('Payeur')
    expect(txt(paymentColumns, 'status', r)).toBe('Sous séquestre')
    expect(txt(paymentColumns, 'status', { ...r, status: 'ODD' })).toBe('Odd')
    expect(txt(paymentColumns, 'beneficiaryHeld', r)).toContain('Retenu depuis le 21/10/2026')
    expect(col(paymentColumns, 'beneficiaryHeld').tone!(r)).toBe('warning')
    expect(txt(paymentColumns, 'beneficiaryHeld', { ...r, beneficiaryHeld: false })).toBe('—')
    expect(col(paymentColumns, 'beneficiaryHeld').tone!({ ...r, beneficiaryHeld: false })).toBe('neutral')
  })

  it('litiges, annulations, signalements, avis, journal', () => {
    const d = { id: 'd', bidId: 'b', type: 'PARCEL_DAMAGED', status: 'OPEN', role: 'SENDER', createdAt: '2026-10-20T10:00:00Z', resolvedAt: null }
    expect(txt(disputeColumns, 'type', d)).toBe('Parcel damaged')
    expect(txt(disputeColumns, 'status', d)).toBe('Ouvert')
    expect(txt(disputeColumns, 'status', { ...d, status: 'RESOLVED' })).toBe('Résolu')
    expect(txt(disputeColumns, 'status', { ...d, status: 'ESCALATED' })).toBe('Escalated')
    expect(txt(disputeColumns, 'resolvedAt', d)).toBe('—')
    const c = { id: 'c', bidId: 'b', reason: 'NO_SHOW', scope: null, status: 'PENDING', declaredByUser: false, createdAt: '2026-10-20T10:00:00Z' }
    expect(txt(cancellationColumns, 'declaredByUser', c)).toBe('L’autre partie')
    expect(txt(cancellationColumns, 'declaredByUser', { ...c, declaredByUser: true })).toBe('Ce compte')
    expect(txt(cancellationColumns, 'reason', c)).toBe('No show')
    expect(txt(cancellationColumns, 'reason', { ...c, reason: null })).toBe('—')
    expect(txt(cancellationColumns, 'scope', c)).toBe('—')
    expect(txt(cancellationColumns, 'scope', { ...c, scope: 'FULL' })).toBe('Full')
    expect(txt(cancellationColumns, 'status', c)).toBe('En attente')
    expect(txt(cancellationColumns, 'status', { ...c, status: 'Z' })).toBe('Z'.toUpperCase())
    const rp = { id: 'r', direction: 'SENT', targetType: 'USER', reason: 'SPAM', status: 'DISMISSED', createdAt: '2026-10-20T10:00:00Z' }
    expect(txt(reportColumns, 'status', rp)).toBe('Rejeté')
    expect(txt(reportColumns, 'status', { ...rp, status: 'NEW' })).toBe('New')
    expect(txt(reportColumns, 'reason', rp)).toBe('Spam')
    expect(txt(reportColumns, 'targetType', rp)).toBe('User')
    const rt = { id: 'x', bidId: 'b', stars: 4, comment: null, flagged: true, createdAt: '2026-10-20T10:00:00Z' }
    expect(txt(ratingColumns, 'stars', rt)).toBe('4 sur 5')
    expect(txt(ratingColumns, 'comment', rt)).toBe('—')
    expect(txt(ratingColumns, 'flagged', rt)).toBe('Signalé')
    expect(col(ratingColumns, 'flagged').tone!(rt)).toBe('warning')
    expect(txt(ratingColumns, 'flagged', { ...rt, flagged: false })).toBe('Non')
    expect(col(ratingColumns, 'flagged').tone!({ ...rt, flagged: false })).toBe('neutral')
    const a = { id: 1, action: 'USER_SUSPENDED', actorName: null, actorId: null, reason: null, createdAt: '2026-10-20T10:00:00Z' }
    expect(txt(auditColumns, 'actorName', a)).toBe('Inconnu')
    expect(txt(auditColumns, 'actorName', { ...a, actorName: 'a@b.fr' })).toBe('a@b.fr')
    expect(txt(auditColumns, 'reason', a)).toBe('—')
    expect(txt(auditColumns, 'action', a)).toBe('User suspended')
    expect(txt(auditColumns, 'createdAt', a)).toContain('20/10/2026')
  })

  it('liens vers les écrans existants', () => {
    expect(parcelLink({ id: 'b1' } as never)).toBe('/colis?open=b1')
    expect(tripLink({ id: 't1' } as never)).toBe('/colis?tab=announcements&announcement=t1')
    expect(requestLink({ id: 'q1' } as never)).toBe('/colis?tab=demandes&open=q1')
    expect(paymentLink({ id: 'p1' } as never)).toBe('/transactions?open=p1')
    expect(disputeLink({ id: 'd1' } as never)).toBe('/incidents?open=d1')
    expect(reportLink({ id: 'r1' } as never)).toBe('/signalements?open=r1')
  })
})
