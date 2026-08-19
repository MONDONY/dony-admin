import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DisputeDetailPanel from '@/features/incidents/components/DisputeDetailPanel.vue'
import type { AdminDisputeDetail } from '@/features/incidents/types/index'
import { seedAuth } from '~/tests/helpers/auth'

vi.mock('@/components/ui/StatusBadge.vue', () => ({ default: { name: 'StatusBadge', template: '<div></div>' } }))
vi.mock('@/components/ui/ConfirmActionDialog.vue', () => ({ default: { name: 'ConfirmActionDialog', template: '<div></div>', props: ['open', 'title', 'message', 'confirmLabel', 'requireReason'], emits: ['confirm', 'cancel'] } }))
vi.mock('@/features/incidents/components/GuaranteeFundForm.vue', () => ({ default: { name: 'GuaranteeFundForm', template: '<div></div>', emits: ['submit'] } }))
vi.mock('@/features/incidents/components/disputeStatus.ts', () => ({ disputeStatusMeta: () => ({ status: 'open', label: 'Ouvert' }) }))

/**
 * L'arbitrage d'un litige engage le fonds de garantie. SUPPORT ne détient pas
 * `DISPUTE_RESOLVE`, mais la spec principale ne monte le panneau qu'en ADMIN : sans ce cas
 * négatif, supprimer le `v-if` laisserait la suite verte tout en rouvrant les trois boutons
 * de décision à un rôle qui prend un 403 sur l'endpoint.
 */
const openDispute = {
  id: 'd1', type: 'Colis endommagé', status: 'OPEN', senderName: 'Alice', travelerName: 'Bob',
  bidId: 'bid-1', description: 'x', createdAt: '2026-08-01T10:00:00Z', evidenceUrls: [],
} as unknown as AdminDisputeDetail

describe('DisputeDetailPanel — vu depuis un rôle sans DISPUTE_RESOLVE', () => {
  beforeEach(() => seedAuth('SUPPORT'))

  it('SUPPORT ne voit aucun bouton de décision sur un litige OUVERT', () => {
    const w = mount(DisputeDetailPanel, { props: { dispute: openDispute, open: true } })
    expect(w.find('[data-test="resolve-sender"]').exists()).toBe(false)
    expect(w.find('[data-test="resolve-traveler"]').exists()).toBe(false)
    expect(w.find('[data-test="resolve-dismiss"]').exists()).toBe(false)
  })

  it('SUPPORT ne voit pas le formulaire de fonds de garantie', () => {
    const w = mount(DisputeDetailPanel, { props: { dispute: openDispute, open: true } })
    expect(w.findComponent({ name: 'GuaranteeFundForm' }).exists()).toBe(false)
  })

  it('SUPPORT garde la consultation du litige', () => {
    const w = mount(DisputeDetailPanel, { props: { dispute: openDispute, open: true } })
    expect(w.find('[data-test="dispute-close"]').exists()).toBe(true)
  })
})

describe('DisputeDetailPanel — vu depuis ADMIN, les mêmes gestes sont offerts', () => {
  beforeEach(() => seedAuth('ADMIN'))

  // Contre-épreuve : sans elle, les trois tests ci-dessus passeraient aussi si le panneau
  // n'affichait jamais ces boutons, pour n'importe quelle raison.
  it('ADMIN voit les trois boutons de décision', () => {
    const w = mount(DisputeDetailPanel, { props: { dispute: openDispute, open: true } })
    expect(w.find('[data-test="resolve-sender"]').exists()).toBe(true)
    expect(w.find('[data-test="resolve-traveler"]').exists()).toBe(true)
    expect(w.find('[data-test="resolve-dismiss"]').exists()).toBe(true)
  })
})
