import { describe, it, expect, beforeEach } from 'vitest'
import { computed } from 'vue'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import MobileMoneyTable from '@/features/finance/components/MobileMoneyTable.vue'
import { toHref, type AdminRoute } from '@/lib/adminLinks'
import type { AdminMobileMoneyPayment } from '@/features/finance/types/index'

const NuxtLink = {
  name: 'NuxtLink', props: ['to'],
  setup(p: { to: string | AdminRoute }) { return { href: computed(() => (typeof p.to === 'string' ? p.to : toHref(p.to))) } },
  template: '<a :href="href"><slot /></a>',
}
const U = '11111111-2222-3333-4444-555555555555'
const B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const P = 'cccccccc-0000-0000-0000-000000000001'
const R = 'dddddddd-0000-0000-0000-000000000002'

const op = (over: Partial<AdminMobileMoneyPayment> = {}): AdminMobileMoneyPayment => ({
  id: 'mm1', paymentId: P, kind: 'DEPOSIT', provider: 'ORANGE_CIV', countryCode: 'CI', phoneNumber: '221771234567',
  amountCents: 75000, currency: 'XOF', status: 'COMPLETED', createdAt: '2026-10-01T10:00:00Z',
  purpose: 'BID_PAYMENT', personId: U, personName: 'Awa Diallo', role: 'SENDER', bidId: B, trackingNumber: 'YD-8F3K2Q', corridor: 'Paris → Dakar', ...over,
})
const mountTable = (payments: AdminMobileMoneyPayment[], props: Record<string, unknown> = {}) =>
  mount(MobileMoneyTable, { props: { payments, loading: false, ...props }, global: { stubs: { NuxtLink } } })
const hrefOf = (w: ReturnType<typeof mountTable>, sel: string) => w.find(sel).attributes('href')

describe('MobileMoneyTable', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('colonnes : Type, Colis, Personne, Opérateur, Montant, Statut, Créée', () => {
    expect(mountTable([op()]).findAll('th').map(t => t.text())).toEqual(['Type', 'Colis', 'Personne', 'Opérateur', 'Montant', 'Statut', 'Créée'])
  })
  it('la ligne : sens, trajet, n° de suivi, personne + rôle, opérateur, montant, statut', () => {
    const w = mountTable([op()])
    const t = w.find('[data-test="mm-row-mm1"]').text()
    for (const s of ['Dépôt', 'Paris → Dakar', 'YD-8F3K2Q', 'Awa Diallo', 'Expéditeur', 'Orange Money', '750,00 XOF', 'Terminée']) expect(t).toContain(s)
  })
  it('numéro TOUJOURS masqué, jamais en clair', () => {
    const w = mountTable([op()])
    expect(w.find('[data-test="mm-phone-mm1"]').text()).toBe('••••••••4567')
    expect(w.find('[data-test="mm-row-mm1"]').text()).not.toContain('221771234567')
  })
  it('motif d’échec à côté du statut', () => {
    const w = mountTable([op({ status: 'FAILED', failureCode: 'PAYER_LIMIT_REACHED' })])
    expect(w.find('[data-test="mm-failure-mm1"]').text()).toBe('PAYER_LIMIT_REACHED')
  })
  it('motif de la recharge affiché sous le sens', () => {
    const w = mountTable([op({ purpose: 'WALLET_TOPUP', paymentId: null, bidId: null, trackingNumber: null, corridor: null })])
    expect(w.find('[data-test="mm-type-mm1"]').text()).toContain('Recharge du solde')
  })

  describe('liens selon le motif', () => {
    it('BID_PAYMENT : colis (trajet + suivi), personne, « Ouvrir le paiement »', () => {
      const w = mountTable([op()])
      expect(hrefOf(w, '[data-test="mm-route-mm1"]')).toBe(`/colis?open=${B}`)
      expect(hrefOf(w, '[data-test="mm-tracking-mm1"]')).toBe(`/colis?open=${B}`)
      expect(hrefOf(w, '[data-test="mm-person-mm1"]')).toBe(`/users/${U}`)
      expect(w.find('[data-test="mm-main-mm1"]').text()).toBe('Ouvrir le paiement')
      expect(hrefOf(w, '[data-test="mm-main-mm1"]')).toBe(`/transactions?open=${P}`)
      expect(w.find('[data-test="mm-retry-mm1"]').exists()).toBe(false)
    })
    it('WALLET_TOPUP : personne seule, onglet Argent', () => {
      const w = mountTable([op({ purpose: 'WALLET_TOPUP', paymentId: null, bidId: null, trackingNumber: null, corridor: null })])
      expect(hrefOf(w, '[data-test="mm-person-mm1"]')).toBe(`/users/${U}?tab=money`)
      expect(w.find('[data-test="mm-route-mm1"]').exists()).toBe(false)
      expect(w.find('[data-test="mm-main-mm1"]').exists()).toBe(false)
    })
    it('WALLET_REFUND : lien vers la demande de remboursement', () => {
      const w = mountTable([op({ purpose: 'WALLET_REFUND', kind: 'REFUND', paymentId: null, bidId: null, walletRefundRequestId: R })])
      expect(hrefOf(w, '[data-test="mm-main-mm1"]')).toBe(`/transactions?tab=wallet-refunds&open=${R}`)
    })
    it('BID_SUPPLEMENT : colis sur l’onglet Argent', () => {
      const w = mountTable([op({ purpose: 'BID_SUPPLEMENT', paymentId: null })])
      expect(hrefOf(w, '[data-test="mm-route-mm1"]')).toBe(`/colis?open=${B}&section=money`)
    })
    it('retryable : « Relancer depuis le paiement » vers l’onglet Incidents', () => {
      const w = mountTable([op({ status: 'FAILED', retryable: true })])
      expect(w.find('[data-test="mm-retry-mm1"]').text()).toBe('Relancer depuis le paiement')
      expect(hrefOf(w, '[data-test="mm-retry-mm1"]')).toBe(`/transactions?open=${P}&section=incidents`)
    })
  })

  describe('permissions et identifiants', () => {
    it('sans BID_VIEW ni USER_VIEW : du texte, aucun <a> colis ni personne', () => {
      seedAuth('SUPPORT', { BID_VIEW: false, USER_VIEW: false })
      const w = mountTable([op()])
      expect(w.find('[data-test="mm-route-mm1"]').element.tagName).not.toBe('A')
      expect(w.find('[data-test="mm-route-mm1"]').text()).toBe('Paris → Dakar')
      expect(w.find('[data-test="mm-tracking-mm1"]').element.tagName).not.toBe('A')
      expect(w.find('[data-test="mm-person-mm1"]').element.tagName).not.toBe('A')
      expect(w.find('[data-test="mm-person-mm1"]').text()).toBe('Awa Diallo')
    })
    it('sans PAYMENT_VIEW : ni « Ouvrir le paiement » ni « Relancer »', () => {
      seedAuth('SUPPORT', { PAYMENT_VIEW: false })
      const w = mountTable([op({ retryable: true })])
      expect(w.find('[data-test="mm-main-mm1"]').exists()).toBe(false)
      expect(w.find('[data-test="mm-retry-mm1"]').exists()).toBe(false)
    })
    it('personne sans nom : pas de lien ni de « undefined »', () => {
      const w = mountTable([op({ personName: null })])
      expect(w.find('[data-test="mm-person-mm1"]').exists()).toBe(false)
      expect(w.find('[data-test="mm-row-mm1"]').findAll('a').some(a => a.attributes('href')?.startsWith('/users'))).toBe(false)
      expect(w.find('[data-test="mm-row-mm1"]').text()).not.toContain('undefined')
    })
  })

  describe('ancien backend (aucun champ enrichi)', () => {
    const old = () => {
      const o: Record<string, unknown> = { ...op() }
      for (const k of ['purpose', 'personId', 'personName', 'role', 'bidId', 'trackingNumber', 'corridor', 'walletRefundRequestId', 'retryable']) delete o[k]
      return o as unknown as AdminMobileMoneyPayment
    }
    it('colonnes d’avant : pas de Colis ni de Personne', () => {
      expect(mountTable([old()]).findAll('th').map(t => t.text())).toEqual(['Type', 'Paiement', 'Opérateur', 'Téléphone', 'Montant', 'Statut', 'Créée'])
    })
    it('aucune cellule « undefined », numéro masqué, le paiement reste relié', () => {
      const w = mountTable([old()])
      expect(w.find('[data-test="mm-row-mm1"]').text()).not.toContain('undefined')
      expect(w.find('[data-test="mm-phone-mm1"]').text()).toBe('••••••••4567')
      expect(hrefOf(w, '[data-test="mm-main-mm1"]')).toBe(`/transactions?open=${P}`)
    })
    it('sans paiement rattaché : un tiret, pas de lien', () => {
      const w = mountTable([{ ...old(), paymentId: null }])
      expect(w.find('[data-test="mm-row-mm1"]').text()).toContain('—')
      expect(w.find('[data-test="mm-main-mm1"]').exists()).toBe(false)
    })
  })

  it('états vides : générique ou fourni', () => {
    expect(mountTable([]).text()).toContain('Aucune opération')
    expect(mountTable([], { emptyLabel: 'Aucune opération en échec' }).text()).toContain('Aucune opération en échec')
  })
  it('état de chargement', () => {
    expect(mountTable([], { loading: true }).text()).toMatch(/Chargement/i)
  })
  it('lecture seule : aucun bouton', () => {
    expect(mountTable([op({ retryable: true })]).findAll('button').length).toBe(0)
  })
})
