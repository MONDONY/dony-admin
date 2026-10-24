/**
 * Incidents → Transactions : « Voir le paiement de ce colis » mène à la liste filtrée sur le colis
 * (`/transactions?bidId=<colis>&view=ALL`), seulement avec PAYMENT_VIEW ; sans elle, aucun `<a>`.
 * Le lien vers le colis de l'absence passe par le registre (BID_VIEW).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DisputeDetailPanel from '@/features/incidents/components/DisputeDetailPanel.vue'
import NoShowDetailPanel from '@/features/incidents/components/NoShowDetailPanel.vue'
import type { AdminDisputeDetail, NoShowDecisionResult } from '@/features/incidents/types/index'
import { seedAuth } from '~/tests/helpers/auth'
import { noShow, NuxtLink } from './noShowFixtures'

const BID = '89125c9c-aaaa-bbbb-cccc-dddddddddddd'
const dispute = {
  id: 'd1', type: 'Colis endommagé', status: 'OPEN', senderName: 'Alice', travelerName: 'Bob',
  bidId: BID, description: 'x', createdAt: '2026-08-01T10:00:00Z', evidenceUrls: [],
} as unknown as AdminDisputeDetail

const mountDispute = (d: AdminDisputeDetail = dispute) =>
  mount(DisputeDetailPanel, { props: { dispute: d, open: true }, global: { stubs: { NuxtLink } } })
const decide = vi.fn<(_d: 'confirm' | 'reject', _r: string) => Promise<NoShowDecisionResult>>()
const mountNoShow = (row = noShow()) =>
  mount(NoShowDetailPanel, { props: { row, decide, now: Date.parse('2026-09-28T10:00:00Z') }, global: { stubs: { NuxtLink } } })

describe('DisputeDetailPanel : paiement du colis', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('lien vers les paiements du colis avec PAYMENT_VIEW', () => {
    const a = mountDispute().get('[data-test="dispute-payment-link"]')
    expect(a.element.tagName).toBe('A')
    expect(a.attributes('href')).toBe(`/transactions?bidId=${BID}&view=ALL`)
    expect(a.text()).toBe('Voir le paiement de ce colis')
  })

  it('sans PAYMENT_VIEW : aucun lien', () => {
    seedAuth('ADMIN', { PAYMENT_VIEW: false })
    expect(mountDispute().find('[data-test="dispute-payment-link"]').exists()).toBe(false)
  })

  it('colis mal formé ou absent : aucun lien, pas de « undefined »', () => {
    const w = mountDispute({ ...dispute, bidId: 'bid-1' } as AdminDisputeDetail)
    expect(w.find('[data-test="dispute-payment-link"]').exists()).toBe(false)
    expect(w.html()).not.toContain('undefined')
  })
})

describe('NoShowDetailPanel : colis et paiement du colis', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('lien vers les paiements du colis avec PAYMENT_VIEW, à côté du lien colis', () => {
    const w = mountNoShow()
    expect(w.get('[data-test="noshow-bid-link"]').attributes('href')).toBe(`/colis?open=${BID}`)
    const a = w.get('[data-test="noshow-payment-link"]')
    expect(a.attributes('href')).toBe(`/transactions?bidId=${BID}&view=ALL`)
    expect(a.text()).toBe('Voir le paiement de ce colis')
    w.unmount()
  })

  it('sans PAYMENT_VIEW : pas de lien paiement ; sans BID_VIEW : le colis reste lisible, sans lien', () => {
    seedAuth('ADMIN', { PAYMENT_VIEW: false, BID_VIEW: false })
    const w = mountNoShow()
    expect(w.find('[data-test="noshow-payment-link"]').exists()).toBe(false)
    expect(w.find('[data-test="noshow-bid-link"]').exists()).toBe(false)
    expect(w.get('[data-test="noshow-bid-text"]').text()).toContain('Colis 89125c9c')
    expect(w.find('[data-test="noshow-bid-text"] a').exists()).toBe(false)
    w.unmount()
  })
})
