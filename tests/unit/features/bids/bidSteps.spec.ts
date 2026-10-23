import { describe, it, expect } from 'vitest'
import { bidStepper } from '@/features/bids/lib/bidSteps'
import type { AdminBidDetail, AdminBidMoney, BidStatus } from '@/features/bids/types'

const mk = (status: string) => ({ paymentId: 'p', status, capturedAt: '2026-06-01T11:00:00Z' }) as AdminBidMoney
const money = mk('ESCROW')
const bid = (status: BidStatus, extra: Partial<AdminBidDetail> = {}): AdminBidDetail =>
  ({ id: 'b', status, createdAt: '2026-06-01T10:00:00Z', ...extra }) as AdminBidDetail
const states = (b: AdminBidDetail) => bidStepper(b).steps.map(s => s.state)
const D = 'done', C = 'current', T = 'todo'

describe('bidStepper', () => {
  it('six étapes dans l’ordre', () => {
    expect(bidStepper(bid('PENDING')).steps.map(s => [s.id, s.label])).toEqual([
      ['created', 'Créé'], ['paid', 'Payé'], ['accepted', 'Accepté'],
      ['handed', 'Remis'], ['transit', 'En transit'], ['delivered', 'Livré'],
    ])
  })

  it.each([
    ['AWAITING_PAYMENT', {}, [C, T, T, T, T, T]],
    ['PENDING', {}, [D, C, T, T, T, T]],
    ['PENDING', { money }, [D, D, C, T, T, T]],
    ['PAYMENT_ESCROWED', { money }, [D, D, C, T, T, T]],
    ['ACCEPTED', { money }, [D, D, D, C, T, T]],
    ['HANDED_OVER', { money }, [D, D, D, D, C, T]],
    ['IN_TRANSIT', { money }, [D, D, D, D, C, T]],
    ['ARRIVED', { money }, [D, D, D, D, C, T]],
    ['COMPLETED', { money }, [D, D, D, D, D, D]],
    ['REJECTED', {}, [D, T, T, T, T, T]],
    ['EXPIRED', {}, [D, T, T, T, T, T]],
    ['CANCELLED', {}, [D, T, T, T, T, T]],
    ['CANCELLED', { money }, [D, D, T, T, T, T]],
    ['NO_SHOW', { money }, [D, D, D, T, T, T]],
    ['PARCEL_REFUSED', { money }, [D, D, D, D, D, T]],
  ] as const)('%s %j', (status, extra, expected) => {
    expect(states(bid(status, extra as Partial<AdminBidDetail>))).toEqual(expected)
  })

  it('statuts non terminaux : ended null', () => {
    expect(bidStepper(bid('IN_TRANSIT')).ended).toBeNull()
    expect(bidStepper(bid('COMPLETED')).ended).toBeNull()
  })

  it.each([
    ['REJECTED', 'Refusé', 'neutral'], ['CANCELLED', 'Annulé', 'neutral'], ['EXPIRED', 'Expiré', 'neutral'],
    ['PARCEL_REFUSED', 'Colis refusé', 'danger'], ['NO_SHOW', 'No-show', 'danger'],
  ] as const)('%s : ended', (status, label, tone) => {
    expect(bidStepper(bid(status)).ended).toEqual({ label, tone })
  })

  it('bidStepper_noShow_endedDanger', () => {
    expect(bidStepper(bid('NO_SHOW', { money })).ended).toEqual({ label: 'No-show', tone: 'danger' })
  })

  it('bidStepper_completed_allDone_withDates', () => {
    const s = bidStepper(bid('COMPLETED', { money, milestones: { deliveredAt: '2026-06-05T09:00:00Z' } as never })).steps
    expect(s[0].at).toBe('2026-06-01T10:00:00Z')
    expect(s[1].at).toBeUndefined()
    expect(s[5].at).toBe('2026-06-05T09:00:00Z')
    expect(s[2].at).toBeUndefined()
  })

  it('bidStepper_pendingWithoutMoney_paymentCurrent', () => {
    const s = bidStepper(bid('PENDING')).steps
    expect(s[1].state).toBe('current')
    expect(s[1].at).toBeUndefined()
  })

  it.each([
    ['CANCELLED', 'FAILED', [D, T, T, T, T, T]],
    ['EXPIRED', 'FAILED', [D, T, T, T, T, T]],
    ['CANCELLED', 'CANCELLED', [D, T, T, T, T, T]],
    ['PENDING', 'PENDING', [D, C, T, T, T, T]],
    ['PENDING', 'ESCROW', [D, D, C, T, T, T]],
    ['PENDING', 'RELEASED', [D, D, C, T, T, T]],
    ['CANCELLED', 'REFUNDED', [D, D, T, T, T, T]],
  ] as const)('%s avec paiement %s', (status, pay, expected) => {
    expect(states(bid(status, { money: mk(pay) }))).toEqual(expected)
  })

  it('arrivedAt : En transit atteint pour un colis refusé ou terminé', () => {
    const milestones = { arrivedAt: '2026-06-04T09:00:00Z' } as never
    expect(states(bid('CANCELLED', { milestones }))).toEqual([D, T, T, T, D, T])
  })

  it('une remise renseignée prolonge un colis annulé', () => {
    const b = bid('CANCELLED', { money, milestones: { handoverLocation: 'Paris' } as never })
    expect(states(b)).toEqual([D, D, D, D, T, T])
  })
})
