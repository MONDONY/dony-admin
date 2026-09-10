import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WalletRefundRequestsTable from '@/features/finance/components/WalletRefundRequestsTable.vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import type { AdminWalletRefundRequest } from '@/features/finance/types/index'

const requests: AdminWalletRefundRequest[] = [
  { id: 'r1', userId: 'u1', currency: 'XOF', amount: 15000, status: 'PENDING', requestedAt: '2026-09-01T10:00:00' },
  { id: 'r2', userId: 'u2', currency: 'EUR', amount: 42.5, status: 'RESOLVED', requestedAt: '2026-08-20T10:00:00' },
]

describe('WalletRefundRequestsTable', () => {
  it('affiche chaque demande dans sa devise avec son statut', () => {
    const w = mount(WalletRefundRequestsTable, { props: { requests, loading: false, busyId: null } })
    expect(w.find('[data-test="wrr-amount-r1"]').text()).toBe(formatMajorAmount(15000, 'XOF'))
    expect(w.find('[data-test="wrr-amount-r2"]').text()).toBe(formatMajorAmount(42.5, 'EUR'))
    expect(w.find('[data-test="wrr-row-r1"]').text()).toContain('En attente')
    expect(w.find('[data-test="wrr-row-r2"]').text()).toContain('Résolue')
  })

  it('ne propose la résolution que sur une demande en attente, et l’émet', async () => {
    const w = mount(WalletRefundRequestsTable, { props: { requests, loading: false, busyId: null } })
    expect(w.find('[data-test="wrr-resolve-r2"]').exists()).toBe(false)
    await w.find('[data-test="wrr-resolve-r1"]').trigger('click')
    expect(w.emitted('resolve')?.[0]).toEqual(['r1'])
  })

  it('verrouille le bouton de la demande en cours de traitement', () => {
    const w = mount(WalletRefundRequestsTable, { props: { requests, loading: false, busyId: 'r1' } })
    const btn = w.find('[data-test="wrr-resolve-r1"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(btn.text()).toContain('Traitement')
  })

  it('affiche les états vide et chargement', () => {
    expect(mount(WalletRefundRequestsTable, { props: { requests: [], loading: false, busyId: null } }).text()).toMatch(/Aucune demande/i)
    expect(mount(WalletRefundRequestsTable, { props: { requests: [], loading: true, busyId: null } }).text()).toMatch(/Chargement/i)
  })
})
