import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WalletsTable from '@/features/finance/components/WalletsTable.vue'
import MobileMoneyTable from '@/features/finance/components/MobileMoneyTable.vue'
import CashCommissionsTable from '@/features/finance/components/CashCommissionsTable.vue'
import { formatAmount, maskPhoneNumber } from '@/features/finance/types/index'
import type { AdminWallet, AdminMobileMoneyPayment, AdminCashCommission } from '@/features/finance/types/index'

const wallets: AdminWallet[] = [
  { id: 'w1', userId: 'u1', balanceCents: 45000, currency: 'EUR', updatedAt: '2026-06-01T10:00:00Z' },
]

const mmPayments: AdminMobileMoneyPayment[] = [
  {
    id: 'mm1', bidId: 'b1', provider: 'WAVE', countryCode: '221', phoneNumber: '771234567',
    amountCents: 75000, currency: 'XOF', status: 'COMPLETED', createdAt: '2026-06-01T10:00:00Z',
  },
]

const cashCommissions: AdminCashCommission[] = [
  {
    bidId: 'b1', amountCents: 25000, commissionCents: 3000, currency: 'EUR',
    status: 'CHARGED', chargedVia: 'WALLET', retryCount: 0, createdAt: '2026-06-01T10:00:00Z',
  },
]

describe('formatAmount', () => {
  it('formate un montant en centimes avec le code devise', () => {
    expect(formatAmount(45000, 'EUR')).toBe('450,00 EUR')
  })
  it('formate un montant XOF', () => {
    expect(formatAmount(75000, 'XOF')).toBe('750,00 XOF')
  })
})

describe('maskPhoneNumber', () => {
  it('masque tous les chiffres sauf les 4 derniers', () => {
    expect(maskPhoneNumber('771234567')).toBe('•••••4567')
  })
  it('laisse un numéro déjà court inchangé', () => {
    expect(maskPhoneNumber('123')).toBe('123')
  })
})

describe('WalletsTable', () => {
  it('affiche une ligne par portefeuille avec solde et devise formatés', () => {
    const w = mount(WalletsTable, { props: { wallets, loading: false } })
    const row = w.find('[data-test="wallet-row-w1"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('u1')
    expect(row.text()).toContain('450,00 EUR')
  })
  it('affiche un état vide explicite', () => {
    expect(mount(WalletsTable, { props: { wallets: [], loading: false } }).text()).toMatch(/Aucun portefeuille/i)
  })
  it('affiche un état de chargement', () => {
    expect(mount(WalletsTable, { props: { wallets: [], loading: true } }).text()).toMatch(/Chargement/i)
  })
  it("ne contient aucun bouton d'action — lecture seule", () => {
    const w = mount(WalletsTable, { props: { wallets, loading: false } })
    expect(w.findAll('button').length).toBe(0)
  })
})

describe('MobileMoneyTable', () => {
  it('affiche une ligne par paiement avec opérateur et montant formaté', () => {
    const w = mount(MobileMoneyTable, { props: { payments: mmPayments, loading: false } })
    const row = w.find('[data-test="mm-row-mm1"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('Wave')
    expect(row.text()).toContain('750,00 XOF')
  })
  it('masque le numéro de téléphone par défaut — donnée personnelle', () => {
    const w = mount(MobileMoneyTable, { props: { payments: mmPayments, loading: false } })
    expect(w.text()).toContain('•••••4567')
    expect(w.text()).not.toContain('771234567')
  })
  it('affiche un état vide explicite', () => {
    expect(mount(MobileMoneyTable, { props: { payments: [], loading: false } }).text()).toMatch(/Aucun paiement/i)
  })
  it('affiche un état de chargement', () => {
    expect(mount(MobileMoneyTable, { props: { payments: [], loading: true } }).text()).toMatch(/Chargement/i)
  })
  it("ne contient aucun bouton d'action — lecture seule", () => {
    const w = mount(MobileMoneyTable, { props: { payments: mmPayments, loading: false } })
    expect(w.findAll('button').length).toBe(0)
  })
})

describe('CashCommissionsTable', () => {
  it('affiche une ligne par demande avec montant et commission formatés', () => {
    const w = mount(CashCommissionsTable, { props: { commissions: cashCommissions, loading: false } })
    const row = w.find('[data-test="cash-commission-row-b1"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('250,00 EUR')
    expect(row.text()).toContain('30,00 EUR')
  })
  it('affiche un placeholder quand le canal de prélèvement est inconnu', () => {
    const w = mount(CashCommissionsTable, { props: { commissions: [{ ...cashCommissions[0], chargedVia: null }], loading: false } })
    expect(w.text()).toContain('—')
  })
  it('affiche un état vide explicite', () => {
    expect(mount(CashCommissionsTable, { props: { commissions: [], loading: false } }).text()).toMatch(/Aucune commission/i)
  })
  it('affiche un état de chargement', () => {
    expect(mount(CashCommissionsTable, { props: { commissions: [], loading: true } }).text()).toMatch(/Chargement/i)
  })
  it("ne contient aucun bouton d'action — lecture seule", () => {
    const w = mount(CashCommissionsTable, { props: { commissions: cashCommissions, loading: false } })
    expect(w.findAll('button').length).toBe(0)
  })
})
