/** Fiche colis : gestes super-admin « Annuler le colis » et « Ouvrir un litige ». */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import type { AdminBidDetail } from '@/features/bids/types/index'

const svc = vi.hoisted(() => ({ cancelBid: vi.fn(), openDispute: vi.fn() }))
vi.mock('@/features/bids/services/bidsAdminService', () => ({ bidsAdminService: svc }))

import BidDetailPanel from '@/features/bids/components/BidDetailPanel.vue'
import { resetBidActionsAvailability } from '@/features/bids/composables/useBidAdminActions'

const ID = '1c1a0000-0000-4000-8000-0000000000b2'
const stubs = {
  NuxtLink: { props: ['to'], template: '<a><slot /></a>' },
  StripeResyncPanel: { template: '<div />' },
  StartSupportConversationDialog: { template: '<div />' },
}
const bid: AdminBidDetail = {
  id: ID, status: 'ACCEPTED', announcementId: 'a1', senderName: 'Awa', travelerName: 'Moussa', corridor: 'Paris → Bamako',
  weightKg: 5, netEur: 40, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-06T18:53:35',
  contentCategory: null, recipientName: null, trackingNumber: null, commissionRate: 0.12, refusalReason: null,
  money: { paymentId: 'p1', status: 'ESCROW', rail: 'STRIPE', amountCents: 4800, commissionCents: 576, refundedCents: 0, currency: 'EUR',
    capturedAt: null, escrowReleasedAt: null, payoutHeldAt: null, disputed: false },
  links: { negotiationThreadId: null, disputeId: null, disputeStatus: null, conversationId: null, cancellationId: null },
}
const mountPanel = (b: AdminBidDetail = bid) => mount(BidDetailPanel, { props: { bid: b, timeline: null, open: true }, global: { stubs } })

async function fillCancel(w: ReturnType<typeof mountPanel>) {
  await w.find('[data-test="action-cancel"]').trigger('click')
  await w.find('[data-test="cancel-reason"]').setValue('SENDER_REQUEST')
  await w.find('[data-test="cancel-ack"]').setValue(true)
}

describe('BidDetailPanel — gestes super-admin', () => {
  beforeEach(() => { seedAuth('SUPER_ADMIN'); svc.cancelBid.mockReset(); svc.openDispute.mockReset(); resetBidActionsAvailability() })

  it('annulation : modale avec l’effet argent, appel, fiche à relire, succès affiché', async () => {
    svc.cancelBid.mockResolvedValue({ bidId: ID, status: 'CANCELLED', previousStatus: 'ACCEPTED', alreadyCancelled: false,
      refundRequested: true, paymentStatus: 'ESCROW', refundAmount: 48, currency: 'EUR', parcelWithTraveler: false })
    const w = mountPanel()
    await fillCancel(w)
    expect(w.find('[data-test="cancel-money-effect"]').text()).toContain('L’expéditeur sera remboursé de 48,00 EUR ; aucun versement au voyageur.')
    await w.find('[data-test="cancel-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.cancelBid).toHaveBeenCalledWith(ID, 'SENDER_REQUEST', '')
    expect(w.emitted('changed')).toHaveLength(1)
    expect(w.find('[data-test="cancel-dialog"]').exists()).toBe(false)
    expect(w.find('[data-test="action-success"]').text()).toContain('Remboursement de 48,00 EUR lancé')
  })

  it('refus du back : message FR dans la modale, qui reste ouverte', async () => {
    svc.cancelBid.mockRejectedValue({ statusCode: 409, data: { code: 'payment-released' } })
    const w = mountPanel()
    await fillCancel(w)
    await w.find('[data-test="cancel-confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="cancel-error"]').text()).toContain('déjà été payé')
    expect(w.emitted('changed')).toBeUndefined()
    await w.find('[data-test="cancel-dismiss"]').trigger('click')
    expect(w.find('[data-test="cancel-dialog"]').exists()).toBe(false)
    expect(w.find('[data-test="action-error"]').text()).toContain('déjà été payé')
  })

  it('ancien back : bouton masqué, « action indisponible sur cet environnement »', async () => {
    svc.cancelBid.mockRejectedValue({ statusCode: 404 })
    const w = mountPanel()
    await fillCancel(w)
    await w.find('[data-test="cancel-confirm"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="cancel-dismiss"]').trigger('click')
    expect(w.find('[data-test="action-cancel"]').exists()).toBe(false)
    expect(w.find('[data-test="unavailable-cancel"]').text()).toContain('Action indisponible sur cet environnement')
  })

  it('litige : modale, appel au nom de l’expéditeur, fiche à relire', async () => {
    svc.openDispute.mockResolvedValue({ disputeId: 'd', bidId: ID, type: 'ADMIN_PARCEL_LOST', status: 'OPEN',
      openedOnBehalfOf: 'SENDER', payoutFrozen: true, paymentStatus: 'ESCROW' })
    const w = mountPanel({ ...bid, status: 'ARRIVED' as never })
    await w.find('[data-test="action-open-dispute"]').trigger('click')
    expect(w.find('[data-test="dispute-money-effect"]').text()).toContain('42,24 EUR net')
    await w.find('[data-test="dispute-party-sender"]').setValue(true)
    await w.find('[data-test="dispute-reason"]').setValue('PARCEL_LOST')
    await w.find('[data-test="dispute-description"]').setValue('Colis introuvable depuis l’arrivée')
    await w.find('[data-test="dispute-ack"]').setValue(true)
    await w.find('[data-test="dispute-confirm"]').trigger('click')
    await flushPromises()
    expect(svc.openDispute).toHaveBeenCalledWith(ID, 'SENDER', 'PARCEL_LOST', 'Colis introuvable depuis l’arrivée')
    expect(w.emitted('changed')).toHaveLength(1)
    expect(w.find('[data-test="action-success"]').text()).toContain('versement au voyageur est gelé')
  })

  it('litige refusé par un ancien back (405) : masqué et expliqué', async () => {
    svc.openDispute.mockRejectedValue({ statusCode: 405 })
    const w = mountPanel()
    await w.find('[data-test="action-open-dispute"]').trigger('click')
    await w.find('[data-test="dispute-party-traveler"]').setValue(true)
    await w.find('[data-test="dispute-reason"]').setValue('OTHER')
    await w.find('[data-test="dispute-description"]').setValue('Différend sur la douane')
    await w.find('[data-test="dispute-ack"]').setValue(true)
    await w.find('[data-test="dispute-confirm"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="dispute-dismiss"]').trigger('click')
    expect(w.find('[data-test="action-open-dispute"]').exists()).toBe(false)
    expect(w.find('[data-test="unavailable-dispute"]').exists()).toBe(true)
  })

  it('admin sans ADMIN_MANAGE : boutons désactivés avec explication', () => {
    seedAuth('ADMIN')
    const w = mountPanel()
    expect(w.find('[data-test="action-cancel"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="action-open-dispute"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="cancel-disabled-reason"]').text()).toContain('Réservé aux super-administrateurs')
    expect(w.find('[data-test="dispute-disabled-reason"]').text()).toContain('Réservé aux super-administrateurs')
  })

  it('colis livré et versé : annulation et litige désactivés avec la raison', () => {
    const w = mountPanel({ ...bid, status: 'COMPLETED', money: { ...bid.money!, status: 'RELEASED', escrowReleasedAt: '2026-10-09T10:00:00' } })
    expect(w.find('[data-test="cancel-disabled-reason"]').text()).toContain('déjà livré')
    expect(w.find('[data-test="dispute-disabled-reason"]').text()).toContain('déjà été payé')
  })

  it('changement de colis : modale fermée et messages effacés', async () => {
    const w = mountPanel()
    await w.find('[data-test="action-cancel"]').trigger('click')
    expect(w.find('[data-test="cancel-dialog"]').exists()).toBe(true)
    await w.setProps({ bid: { ...bid, id: '1c1a0000-0000-4000-8000-0000000000b3' } })
    expect(w.find('[data-test="cancel-dialog"]').exists()).toBe(false)
  })
})
