import { describe, it, expect } from 'vitest'
import {
  announcementStatusMeta, bidPaymentMethodLabel, bidTimelineLabel, bidTimelineTone, countryName, disputeStatusLabel,
  formatDateTime, formatDay, formatKg, formatTime, mobileMoneyLabel, placeLabel, stripeAccountLabel, transportModeLabel,
  userStatusMeta,
} from '@/features/bids/lib/bidLabels'
import { bidStatusMeta, bidStatusPhrase } from '@/features/bids/components/bidStatus'

describe('bidLabels', () => {
  it('chronologie : codes connus, codes de paiement, repli lisible', () => {
    expect(bidTimelineLabel('PRESENCE_CONFIRMED')).toBe('Présence confirmée par le voyageur')
    expect(bidTimelineLabel('PAYMENT_CAPTURED')).toBe('Carte débitée (capture)')
    expect(bidTimelineLabel('SOMETHING_ELSE')).toBe('Something else')
  })
  it('tons de la chronologie', () => {
    expect(bidTimelineTone('EVENT', 'BID_CANCELLED')).toBe('danger')
    expect(bidTimelineTone('PAYMENT', 'PAYMENT_CREATED')).toBe('success')
    expect(bidTimelineTone('SCAN', 'DEPART')).toBe('info')
    expect(bidTimelineTone('EVENT', 'DELIVERED')).toBe('info')
    expect(bidTimelineTone('EVENT', 'BID_CREATED')).toBe('neutral')
  })
  it('annonce, transport, paiement, Stripe, mobile money, litige, compte', () => {
    expect(announcementStatusMeta('ACTIVE').label).toBe('Publiée')
    expect(announcementStatusMeta(null).label).toBe('Inconnu')
    expect(announcementStatusMeta('NEW_ONE').label).toBe('New one')
    expect(transportModeLabel('PLANE')).toBe('Avion')
    expect(transportModeLabel('OTHER')).toBe('Autre')
    expect(transportModeLabel('ROCKET')).toBe('Rocket')
    expect(transportModeLabel(null)).toBeNull()
    expect(bidPaymentMethodLabel('CASH')).toBe('Espèces à la remise')
    expect(bidPaymentMethodLabel('NEW_RAIL')).toBe('New rail')
    expect(bidPaymentMethodLabel(null)).toBe('—')
    expect(stripeAccountLabel('PENDING_ONBOARDING')).toBe('Inscription Stripe inachevée')
    expect(stripeAccountLabel(null)).toBe('Aucun compte')
    expect(stripeAccountLabel('ODD')).toBe('Odd')
    expect(mobileMoneyLabel('ACTIVE')).toBe('Actif')
    expect(mobileMoneyLabel(null)).toBe('Non configuré')
    expect(mobileMoneyLabel('ODD')).toBe('Odd')
    expect(disputeStatusLabel('OPEN')).toBe('ouvert')
    expect(disputeStatusLabel('ESCALATED')).toBe('escalated')
    expect(disputeStatusLabel(null)).toBe('')
    expect(userStatusMeta('BANNED').label).toBe('Banni')
    expect(userStatusMeta('ODD').label).toBe('Odd')
  })
  it('pays et lieux', () => {
    expect(countryName('ml')).toBe('Mali')
    expect(countryName(null)).toBeNull()
    expect(countryName('not-a-code')).toBe('not-a-code')
    expect(placeLabel('Dakar', 'SN')).toBe('Dakar (Sénégal)')
    expect(placeLabel('Dakar', null)).toBe('Dakar')
    expect(placeLabel(null, 'SN')).toBe('Sénégal')
    expect(placeLabel(null, null)).toBe('—')
  })
  it('dates, heures, poids', () => {
    expect(formatDay('2026-10-12')).toBe('lundi 12 octobre 2026')
    expect(formatDay('12/10/2026')).toBeNull()
    expect(formatDay(null)).toBeNull()
    expect(formatTime('09:30:00')).toBe('09:30')
    expect(formatTime('9h')).toBeNull()
    expect(formatTime(null)).toBeNull()
    expect(formatDateTime('2026-10-06T18:53:35')).toMatch(/2026/)
    expect(formatDateTime(null)).toBeNull()
    expect(formatKg(2.5)).toBe('2,5 kg')
    expect(formatKg(null)).toBeNull()
  })
  it('statuts du colis : libellé, phrase, repli', () => {
    expect(bidStatusMeta('PAYMENT_ESCROWED').label).toBe('Payé (séquestre)')
    expect(bidStatusMeta('NO_SHOW').label).toBe('Absence (no-show)')
    expect(bidStatusPhrase('IN_TRANSIT')).toContain('en route')
    expect(bidStatusPhrase('X' as never)).toBeNull()
  })
})
