import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BidIncidentsTab from '@/features/bids/components/BidIncidentsTab.vue'
import type { AdminBidDetail, AdminBidIncidents } from '@/features/bids/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }
const bidWith = (incidents: AdminBidIncidents | null | undefined) => ({ id: 'b1', incidents }) as unknown as AdminBidDetail
const mountTab = (incidents: AdminBidIncidents | null | undefined) =>
  mount(BidIncidentsTab, { props: { bid: bidWith(incidents) }, global: { stubs: { NuxtLink } } })

const full: AdminBidIncidents = {
  disputes: [
    { id: 'd-1', type: 'RECIPIENT_NO_SHOW', status: 'OPEN', createdAt: '2026-10-23T22:30:00', resolvedAt: null, resolutionType: null },
    { id: 'd-2', type: 'ADMIN_PARCEL_LOST', status: 'RESOLVED', createdAt: '2026-10-20T10:00:00', resolvedAt: '2026-10-21T10:00:00', resolutionType: 'REFUND_FULL' },
  ],
  cancellations: [
    { id: 'c-1', scope: 'HANDOVER', noShowStatus: 'PENDING_CONFIRMATION', reason: 'SENDER_NO_SHOW', createdAt: '2026-10-22T09:00:00' },
    { id: 'c-2', scope: 'DELIVERY', noShowStatus: 'CONFIRMED', reason: 'RECIPIENT_NO_SHOW', createdAt: null },
  ],
}

describe('BidIncidentsTab', () => {
  beforeEach(() => { seedAuth('SUPER_ADMIN') })

  it('incidentsTab_listsDisputesAndCancellations', () => {
    const w = mountTab(full)
    const disputes = w.findAll('[data-test="incident-dispute"]')
    expect(disputes).toHaveLength(2)
    expect(disputes[0]!.text()).toContain('Destinataire absent')
    expect(disputes[0]!.text()).toContain('ouvert')
    // 22:30 UTC sans Z : minuit passé à Paris, le lendemain.
    expect(disputes[0]!.text()).toContain('24/10/2026 00:30')
    expect(disputes[1]!.text()).toContain('Colis perdu')
    expect(disputes[1]!.text()).toContain('résolu')
    expect(disputes[1]!.text()).toContain('Résolution')
    expect(disputes[1]!.text()).toContain('REFUND_FULL')
    expect(disputes[0]!.text()).not.toContain('Résolution')
    const cancels = w.findAll('[data-test="incident-cancellation"]')
    expect(cancels).toHaveLength(2)
    expect(cancels[0]!.text()).toContain('Remise')
    expect(cancels[0]!.text()).toContain('En attente')
    expect(cancels[0]!.text()).toContain('Expéditeur absent à la remise')
    expect(cancels[0]!.text()).toContain('22/10/2026 11:00')
    expect(cancels[1]!.text()).toContain('Livraison')
    expect(cancels[1]!.text()).toContain('Absence confirmée')
    expect(w.find('[data-test="incidents-empty"]').exists()).toBe(false)
  })

  it('incidentsTab_empty', () => {
    const w = mountTab({ disputes: [], cancellations: [] })
    expect(w.find('[data-test="incidents-empty"]').text()).toBe('Aucun incident sur ce colis.')
  })

  it('incidentsTab_unknownLabelsFallback', () => {
    const w = mountTab({
      disputes: [{ id: 'd-9', type: 'NOUVEAU_TYPE', status: 'EN_PAUSE', createdAt: null, resolvedAt: null, resolutionType: null }],
      cancellations: [{ id: 'c-9', scope: 'AILLEURS', noShowStatus: 'BIZARRE', reason: 'MOTIF_X', createdAt: null }],
    })
    const d = w.find('[data-test="incident-dispute"]').text()
    expect(d).toContain('NOUVEAU_TYPE')
    expect(d).toContain('en_pause')
    const c = w.find('[data-test="incident-cancellation"]').text()
    expect(c).toContain('AILLEURS')
    expect(c).toContain('BIZARRE')
    expect(c).toContain('MOTIF_X')
  })

  it('incidentsTab_linksPointToIncidents', () => {
    const w = mountTab(full)
    expect(w.find('[data-test="incident-dispute-link-d-1"]').attributes('data-to')).toBe(JSON.stringify('/incidents?open=d-1'))
    expect(w.find('[data-test="incident-dispute-link-d-1"]').text()).toBe('Ouvrir le litige')
    expect(w.find('[data-test="incident-noshow-link-c-1"]').attributes('data-to')).toBe(JSON.stringify('/incidents?tab=noshows&open=c-1'))
    expect(w.find('[data-test="incident-noshow-link-c-1"]').text()).toBe('Ouvrir l’absence')
  })

  it('incidentsTab_noLinksWithoutDisputeView', () => {
    seedAuth('ADMIN', { DISPUTE_VIEW: false })
    const w = mountTab(full)
    expect(w.find('[data-test^="incident-dispute-link-"]').exists()).toBe(false)
    expect(w.find('[data-test^="incident-noshow-link-"]').exists()).toBe(false)
    expect(w.findAll('[data-test="incident-dispute"]')).toHaveLength(2)
  })

  it('incidentsTab_microsecondsAndDst', () => {
    const w = mountTab({ disputes: [{ id: 'd-5', type: 'OTHER', status: 'OPEN', createdAt: '2026-10-23T22:30:00.123456', resolvedAt: '2026-03-29T01:30:00', resolutionType: null }], cancellations: [] })
    expect(w.text()).toContain('24/10/2026 00:30')
    expect(w.text()).toContain('29/03/2026 03:30')
  })

  it('incidentsTab_absentField_showsEmpty', () => {
    expect(mountTab(undefined).find('[data-test="incidents-empty"]').exists()).toBe(true)
  })
})
