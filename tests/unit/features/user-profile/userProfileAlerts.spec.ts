import { describe, it, expect } from 'vitest'
import { buildAlerts } from '@/features/user-profile/lib/userProfileAlerts'
import type { UserOverviewKpis } from '@/features/user-profile/types/index'

const NULLS: UserOverviewKpis = {
  parcelsInProgress: null, activeTrips: null, heldByCurrency: null, openDisputes: null, totalDisputes: null,
  reportsReceived: null, reportsSent: null, reportsPending: null, averageRating: null, ratingCount: null,
}
const ok = { status: 'ACTIVE' }

describe('buildAlerts', () => {
  it('tout null : aucune alerte', () => {
    expect(buildAlerts(ok, NULLS)).toEqual([])
  })
  it('zéro et liste vide : aucune alerte', () => {
    expect(buildAlerts(ok, { ...NULLS, openDisputes: 0, reportsPending: 0, heldByCurrency: [] })).toEqual([])
  })
  it('compte suspendu', () => {
    expect(buildAlerts({ status: 'SUSPENDED' }, NULLS).map(a => a.id)).toEqual(['suspended'])
  })
  it('compte banni', () => {
    expect(buildAlerts({ status: 'BANNED' }, NULLS).map(a => a.id)).toEqual(['banned'])
  })
  it('suppression demandée', () => {
    const a = buildAlerts({ status: 'ACTIVE', deletionScheduledFor: '2026-11-02T00:00:00Z' }, NULLS)
    expect(a.map(x => x.id)).toEqual(['deletion'])
  })
  it('litiges ouverts, singulier et pluriel', () => {
    expect(buildAlerts(ok, { ...NULLS, openDisputes: 1 })[0]!.text).toBe('1 litige ouvert')
    expect(buildAlerts(ok, { ...NULLS, openDisputes: 3 })[0]!.text).toBe('3 litiges ouverts')
  })
  it('signalements à traiter, singulier et pluriel', () => {
    expect(buildAlerts(ok, { ...NULLS, reportsPending: 1 })[0]!.text).toBe('1 signalement à traiter')
    expect(buildAlerts(ok, { ...NULLS, reportsPending: 2 })[0]!.text).toBe('2 signalements à traiter')
  })
  it('deux devises retenues : une seule alerte listant chaque devise', () => {
    const a = buildAlerts(ok, { ...NULLS, heldByCurrency: [
      { currency: 'EUR', amountCents: 4200 }, { currency: 'XOF', amountCents: 1500000 },
    ] })
    expect(a).toHaveLength(1)
    expect(a[0]!.id).toBe('held')
    expect(a[0]!.text).toContain('42,00 EUR')
    expect(a[0]!.text).toContain('15 000,00 XOF')
  })

  it('PENDING_DELETION sans date : alerte de suppression sans date', () => {
    const a = buildAlerts({ status: 'PENDING_DELETION', deletionScheduledFor: null }, NULLS)
    expect(a.map(x => x.id)).toEqual(['deletion'])
    expect(a[0]!.text).not.toMatch(/\d/)
  })
})
