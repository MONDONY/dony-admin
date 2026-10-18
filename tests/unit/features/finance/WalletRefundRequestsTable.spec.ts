import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WalletRefundRequestsTable from '@/features/finance/components/WalletRefundRequestsTable.vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import type { AdminWalletRefundRequest } from '@/features/finance/types/index'

const requests: AdminWalletRefundRequest[] = [
  { id: 'r1', userId: 'u1', currency: 'XOF', amount: 15000, status: 'PENDING', requestedAt: '2026-09-01T10:00:00' },
  { id: 'r2', userId: 'u2', currency: 'EUR', amount: 42.5, status: 'RESOLVED', requestedAt: '2026-08-20T10:00:00' },
]

const automatic: AdminWalletRefundRequest[] = [
  {
    id: 'a1', userId: '0f1e2d3c-aaaa-bbbb-cccc-000000000001', currency: 'EUR', amount: 9.05, status: 'REFUNDED',
    requestedAt: '2026-10-14T18:29:40', resolvedAt: '2026-10-14T18:30:10', channel: 'AUTOMATIC_STRIPE',
    userName: 'Awa Diop', origin: 'ACCOUNT_DELETION', parentRequestId: null,
  },
  {
    id: 'a2', userId: 'u3', currency: 'XOF', amount: 20000, status: 'PENDING', requestedAt: '2026-10-14T18:29:40',
    channel: 'AUTOMATIC_PAWAPAY', userName: null, origin: 'WALLET',
  },
  {
    id: 'm1', userId: 'u4', currency: 'EUR', amount: 12, status: 'PENDING', requestedAt: '2026-10-15T08:00:00',
    channel: 'MANUAL_ADMIN', userName: 'Moussa K', origin: 'ACCOUNT_DELETION', parentRequestId: 'a9',
  },
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

  it('affiche le montant versé, les frais et la note d’une demande résolue, rien sinon', () => {
    const resolved: AdminWalletRefundRequest[] = [
      {
        id: 'x1', userId: 'u1', currency: 'XOF', amount: 500, status: 'RESOLVED', requestedAt: '2026-10-17T10:00:00',
        channel: 'MANUAL_ADMIN', paidAmount: 487, resolutionNote: 'Versé par Wave', feeAmount: 13,
      },
      { id: 'x2', userId: 'u2', currency: 'EUR', amount: 12, status: 'RESOLVED', requestedAt: '2026-10-17T10:00:00', feeAmount: 0 },
    ]
    const w = mount(WalletRefundRequestsTable, { props: { requests: resolved, loading: false, busyId: null } })
    expect(w.find('[data-test="wrr-paid-x1"]').text()).toBe('Versé : ' + formatMajorAmount(487, 'XOF'))
    expect(w.find('[data-test="wrr-fee-x1"]').text()).toBe('Frais : ' + formatMajorAmount(13, 'XOF'))
    expect(w.find('[data-test="wrr-note-x1"]').text()).toBe('Note : Versé par Wave')
    expect(w.find('[data-test="wrr-paid-x2"]').exists()).toBe(false)
    expect(w.find('[data-test="wrr-fee-x2"]').exists()).toBe(false)
    expect(w.find('[data-test="wrr-note-x2"]').exists()).toBe(false)
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

  it('montre nom, origine et canal d’un remboursement automatique de compte supprimé', () => {
    const w = mount(WalletRefundRequestsTable, { props: { requests: automatic, loading: false, busyId: null } })
    expect(w.find('[data-test="wrr-user-a1"]').text()).toBe('Awa Diop')
    expect(w.find('[data-test="wrr-origin-a1"]').text()).toContain('Suppression du compte')
    expect(w.find('[data-test="wrr-channel-a1"]').text()).toBe('Carte, automatique')
    expect(w.find('[data-test="wrr-row-a1"]').text()).toContain('Remboursée')
    expect(w.find('[data-test="wrr-row-a1"]').text()).toContain('Clos le')
    expect(w.find('[data-test="wrr-user-a2"]').text()).toBe('Utilisateur')
    expect(w.find('[data-test="wrr-origin-m1"]').text()).toContain('Reprise d')
  })

  it('aucun bouton sur un remboursement automatique, même en attente ; bouton sur le ticket manuel', () => {
    const w = mount(WalletRefundRequestsTable, { props: { requests: automatic, loading: false, busyId: null } })
    expect(w.find('[data-test="wrr-resolve-a1"]').exists()).toBe(false)
    expect(w.find('[data-test="wrr-resolve-a2"]').exists()).toBe(false)
    expect(w.find('[data-test="wrr-resolve-m1"]').exists()).toBe(true)
  })

  it('affiche le libellé vide fourni par la vue', () => {
    const w = mount(WalletRefundRequestsTable, { props: { requests: [], loading: false, busyId: null, emptyLabel: 'Aucun remboursement en cours' } })
    expect(w.text()).toContain('Aucun remboursement en cours')
  })

  it('propose « Relancer le remboursement » sur un ticket manuel en attente venu du mobile money, et l’émet', async () => {
    const rows: AdminWalletRefundRequest[] = [
      { id: 'mm', userId: 'u1', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-18T10:00:00', channel: 'MANUAL_ADMIN', sourceRail: 'PAWAPAY', failureReason: 'PAWAPAY_WALLET_OUT_OF_FUNDS' },
      { id: 'card', userId: 'u2', currency: 'EUR', amount: 40, status: 'PENDING', requestedAt: '2026-10-18T10:00:00', channel: 'MANUAL_ADMIN', sourceRail: 'STRIPE' },
      { id: 'root', userId: 'u3', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-18T10:00:00', channel: 'MANUAL_ADMIN', sourceRail: null },
      { id: 'old', userId: 'u4', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-18T10:00:00', channel: 'MANUAL_ADMIN' },
      { id: 'auto', userId: 'u5', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-18T10:00:00', channel: 'AUTOMATIC_PAWAPAY', sourceRail: 'PAWAPAY' },
      { id: 'run', userId: 'u6', currency: 'XOF', amount: 500, status: 'PROCESSING', requestedAt: '2026-10-18T10:00:00', channel: 'MANUAL_ADMIN', sourceRail: 'PAWAPAY' },
    ]
    const w = mount(WalletRefundRequestsTable, { props: { requests: rows, loading: false, busyId: null } })
    expect(w.find('[data-test="wrr-retry-mm"]').text()).toBe('Relancer le remboursement')
    expect(w.find('[data-test="wrr-resolve-mm"]').exists()).toBe(true)
    expect(w.find('[data-test="wrr-retry-card"]').exists()).toBe(false)
    expect(w.find('[data-test="wrr-retry-root"]').exists()).toBe(false)
    // Ancien backend sans sourceRail : le bouton reste proposé, l'aperçu tranchera.
    expect(w.find('[data-test="wrr-retry-old"]').exists()).toBe(true)
    expect(w.find('[data-test="wrr-retry-auto"]').exists()).toBe(false)
    expect(w.find('[data-test="wrr-retry-run"]').exists()).toBe(false)
    expect(w.find('[data-test="wrr-failure-mm"]').text()).toBe('Motif : Wallet pawaPay sans fonds')
    await w.find('[data-test="wrr-retry-mm"]').trigger('click')
    expect(w.emitted('retry')?.[0]).toEqual(['mm'])
  })
})
