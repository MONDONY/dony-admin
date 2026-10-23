/** Bandeau d'alerte du tiroir : affiche `bid.alert` du back, jamais recalculé côté front. */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BidAlertBanner from '@/features/bids/components/BidAlertBanner.vue'
import type { AdminBidDetail } from '@/features/bids/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }
const links = { negotiationThreadId: null, disputeId: 'dsp-1', disputeStatus: 'OPEN', conversationId: null, cancellationId: 'c-1' }
const base = {
  id: 'b1', status: 'IN_TRANSIT', announcementId: 'a1', senderName: 'Awa', travelerName: 'Moussa', corridor: 'Paris → Dakar',
  weightKg: 5, netEur: 40, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-06T18:53:35',
  contentCategory: null, recipientName: null, trackingNumber: null, commissionRate: null, refusalReason: null, links,
} as AdminBidDetail
const mountBanner = (bid: Partial<AdminBidDetail>) => mount(BidAlertBanner, { props: { bid: { ...base, ...bid } }, global: { stubs: { NuxtLink } } })

describe('BidAlertBanner', () => {
  beforeEach(() => { seedAuth('SUPER_ADMIN') })

  it('banner_disputeOpen : texte, statut du litige et lien vers l’incident', () => {
    const w = mountBanner({ alert: 'DISPUTE_OPEN' })
    const b = w.find('[data-test="bid-alert-banner"]')
    expect(b.attributes('data-code')).toBe('DISPUTE_OPEN')
    expect(b.text()).toContain('Litige ouvert')
    expect(w.find('[data-test="bid-alert-detail"]').text()).toBe('Statut du litige : ouvert')
    const link = w.find('[data-test="bid-alert-link"]')
    expect(link.text()).toContain('Voir l’incident')
    expect(JSON.parse(link.attributes('data-to')!)).toEqual({ path: '/incidents', query: { open: 'dsp-1' } })
  })

  it('banner_disputeLink_requiresDisputeView : sans droit ou sans id, pas de lien', () => {
    seedAuth('SUPPORT', { DISPUTE_VIEW: false })
    expect(mountBanner({ alert: 'DISPUTE_OPEN' }).find('[data-test="bid-alert-link"]').exists()).toBe(false)
    seedAuth('SUPER_ADMIN')
    const noId = mountBanner({ alert: 'DISPUTE_OPEN', links: { ...links, disputeId: null, disputeStatus: null } })
    expect(noId.find('[data-test="bid-alert-banner"]').text()).toContain('Litige ouvert')
    expect(noId.find('[data-test="bid-alert-link"]').exists()).toBe(false)
    expect(noId.find('[data-test="bid-alert-detail"]').exists()).toBe(false)
  })

  it('banner_noShow : absence signalée et lien vers le no-show', () => {
    const w = mountBanner({ alert: 'NO_SHOW', status: 'NO_SHOW' })
    expect(w.find('[data-test="bid-alert-banner"]').text()).toContain('Absence signalée')
    expect(JSON.parse(w.find('[data-test="bid-alert-link"]').attributes('data-to')!))
      .toEqual({ path: '/incidents', query: { tab: 'noshows', open: 'c-1' } })
    expect(mountBanner({ alert: 'NO_SHOW', status: 'NO_SHOW', links: { ...links, cancellationId: null } }).find('[data-test="bid-alert-link"]').exists()).toBe(false)
  })

  it('banner_paymentPending', () => {
    const w = mountBanner({ alert: 'PAYMENT_PENDING' })
    expect(w.find('[data-test="bid-alert-banner"]').text()).toContain('Paiement en attente')
    expect(w.find('[data-test="bid-alert-link"]').exists()).toBe(false)
  })

  it('banner_late', () => {
    const w = mountBanner({ alert: 'LATE' })
    expect(w.find('[data-test="bid-alert-banner"]').text()).toContain('Livraison en retard')
  })

  it('banner_none_whenAlertAbsent : rien sans alerte, ni pour un code inconnu, même avec un litige ouvert', () => {
    expect(mountBanner({}).find('[data-test="bid-alert-banner"]').exists()).toBe(false)
    expect(mountBanner({ alert: null }).find('[data-test="bid-alert-banner"]').exists()).toBe(false)
    expect(mountBanner({ alert: 'WEIRD' as never }).find('[data-test="bid-alert-banner"]').exists()).toBe(false)
    // Statut NO_SHOW sans alerte du back : pas de bandeau recalculé.
    expect(mountBanner({ status: 'NO_SHOW', links: undefined }).find('[data-test="bid-alert-banner"]').exists()).toBe(false)
  })
})
