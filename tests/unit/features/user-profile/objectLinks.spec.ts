import { describe, it, expect } from 'vitest'
import { linkForItem, linkForTimeline } from '@/features/user-profile/lib/objectLinks'
import type { TimelineEntry } from '@/features/user-profile/types/index'

const entry = (kind: TimelineEntry['kind'], refId: string | null, refType: string | null = kind): TimelineEntry =>
  ({ kind, title: 't', detail: 'd', at: '2026-10-20T10:00:00Z', refType, refId })

describe('objectLinks', () => {
  it('colis et trajet', () => {
    expect(linkForItem({ kind: 'PARCEL', id: 'a1' })).toBe('/colis?open=a1')
    expect(linkForItem({ kind: 'TRIP', id: 't1' })).toBe('/colis?tab=announcements&announcement=t1')
  })
  it('type inconnu : pas de lien', () => {
    expect(linkForItem({ kind: 'OTHER', id: 'x' })).toBeNull()
  })
  it('chaque type de la frise', () => {
    expect(linkForTimeline(entry('PARCEL', 'b'))).toBe('/colis?open=b')
    expect(linkForTimeline(entry('PAYMENT', 'p'))).toBe('/transactions?open=p')
    expect(linkForTimeline(entry('DISPUTE', 'd'))).toBe('/incidents?open=d')
    expect(linkForTimeline(entry('REPORT', 'r'))).toBe('/signalements?open=r')
  })
  it('refId null ou refType inconnu : pas de lien', () => {
    expect(linkForTimeline(entry('PARCEL', null))).toBeNull()
    expect(linkForTimeline(entry('PARCEL', 'b', 'WHATEVER'))).toBeNull()
    expect(linkForTimeline(entry('PARCEL', 'b', null))).toBeNull()
  })
})
