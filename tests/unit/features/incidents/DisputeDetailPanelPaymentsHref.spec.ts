/**
 * « Voir le paiement de ce colis » : l'URL est calculée une seule fois par litige (computed), pas
 * à chaque évaluation du gabarit ; elle suit le litige affiché quand il change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminDisputeDetail } from '@/features/incidents/types/index'
import { seedAuth } from '~/tests/helpers/auth'
import { NuxtLink } from './noShowFixtures'

const spy = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@/lib/adminLinks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/adminLinks')>()
  return { ...actual, paymentsOfBidRoute: (id: unknown) => { spy.calls++; return actual.paymentsOfBidRoute(id) } }
})

import DisputeDetailPanel from '@/features/incidents/components/DisputeDetailPanel.vue'

const BID = '89125c9c-aaaa-bbbb-cccc-dddddddddddd'
const OTHER = '79125c9c-aaaa-bbbb-cccc-dddddddddddd'
const dispute = (bidId: string) => ({
  id: 'd1', type: 'Colis endommagé', status: 'OPEN', senderName: 'Alice', travelerName: 'Bob',
  bidId, description: 'x', createdAt: '2026-08-01T10:00:00Z', evidenceUrls: [],
}) as unknown as AdminDisputeDetail

describe('DisputeDetailPanel : URL des paiements du colis calculée une fois', () => {
  beforeEach(() => { seedAuth('ADMIN'); spy.calls = 0 })

  it('un seul calcul au rendu ; recalculée seulement quand le colis du litige change', async () => {
    const w = mount(DisputeDetailPanel, { props: { dispute: dispute(BID), open: true }, global: { stubs: { NuxtLink } } })
    expect(w.get('[data-test="dispute-payment-link"]').attributes('href')).toBe(`/transactions?bidId=${BID}&view=ALL`)
    expect(spy.calls).toBe(1)
    await w.setProps({ open: true, splitOptions: null })
    expect(spy.calls).toBe(1)
    await w.setProps({ dispute: dispute(OTHER) })
    expect(w.get('[data-test="dispute-payment-link"]').attributes('href')).toBe(`/transactions?bidId=${OTHER}&view=ALL`)
    expect(spy.calls).toBe(2)
    w.unmount()
  })
})
