import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computed } from 'vue'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import { formatMoney } from '@/features/payments/types/index'
import type { AdminPaymentListItem, PaymentInsight } from '@/features/payments/types/index'
import { toHref, type AdminRoute } from '@/lib/adminLinks'

const NuxtLink = {
  name: 'NuxtLink', props: ['to'],
  setup(p: { to: string | AdminRoute }) { return { href: computed(() => (typeof p.to === 'string' ? p.to : toHref(p.to))) } },
  template: '<a :href="href"><slot /></a>',
}
const global = { stubs: { NuxtLink } }

const payments = [
  { id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 12345, commissionCents: 1480, currency: 'EUR', createdAt: '2026-06-01T10:00:00Z' },
  // Recette du 2026-09-09 : 6 600 XOF s'affichaient « 6 600,00 € ».
  { id: 'p2', bidId: 'b2', status: 'RELEASED', method: 'PAWAPAY', amountCents: 660000, commissionCents: 60000, currency: 'XOF', createdAt: '2026-09-09T15:09:00Z' },
] as AdminPaymentListItem[]

const SENDER = '11111111-2222-3333-4444-555555555555'
const TRAVELER = '99999999-8888-7777-6666-555555555555'
const BID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const PAY = 'cccccccc-0000-0000-0000-000000000001'

function insight(over: Partial<PaymentInsight> = {}): PaymentInsight {
  return {
    kind: 'BID', bidId: BID, negotiationThreadId: null,
    sender: { id: SENDER, name: 'Awa Diallo' }, traveler: { id: TRAVELER, name: 'Ibrahima Ndiaye' },
    departureCity: 'Paris', arrivalCity: 'Dakar', bidStatus: 'IN_TRANSIT', abandoned: false,
    netTravelerCents: 19440, capturedAt: null, fxExchangeRate: null, stripeChargeId: null, stripeDashboardUrl: null, ...over,
  }
}
const rich = (over: Partial<AdminPaymentListItem> = {}): AdminPaymentListItem => ({
  id: PAY, bidId: null, status: 'ESCROW', method: 'STRIPE', amountCents: 21300, commissionCents: 1860, currency: 'EUR',
  createdAt: '2026-10-19T10:00:00', insight: insight(), trackingNumber: 'YD-8F3K2Q', alert: 'ESCROW_J48', ...over,
})
const mountTable = (list: AdminPaymentListItem[], props: Record<string, unknown> = {}) =>
  mount(PaymentsTable, { props: { payments: list, loading: false, ...props }, global })

describe('PaymentsTable', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('renders rows with formatted amount + emits select', async () => {
    const w = mountTable(payments)
    expect(w.text()).toContain('Sous séquestre'); expect(w.text()).toContain('123,45')
    await w.find('[data-test="payment-row-p1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['p1'])
  })
  it('affiche chaque montant dans la devise du paiement, jamais en euros par défaut', () => {
    const w = mountTable(payments)
    expect(w.find('[data-test="payment-amount-p1"]').text()).toBe(formatMoney(12345, 'EUR'))
    expect(w.find('[data-test="payment-amount-p2"]').text()).toBe(formatMoney(660000, 'XOF'))
    expect(w.find('[data-test="payment-row-p2"]').text()).not.toContain('€')
  })
  it('traduit le rail en libellé lisible', () => {
    const w = mountTable(payments)
    expect(w.find('[data-test="payment-row-p1"]').text()).toContain('Carte')
    expect(w.find('[data-test="payment-row-p2"]').text()).toContain('Mobile money')
  })
  it('formatMoney : sans devise connue, le montant sort nu, jamais « undefined » ni en euros', () => {
    expect(formatMoney(12345, undefined)).toBe(formatMoney(12345, 'EUR').replace(' EUR', ''))
    expect(formatMoney(12345, undefined)).not.toContain('undefined')
    expect(formatMoney(12345, undefined)).not.toContain('€')
  })
  it('empty state', () => { expect(mountTable([]).text()).toMatch(/Aucun paiement/i) })
  it('état vide personnalisé (vue « À traiter » vide)', () => {
    expect(mountTable([], { emptyLabel: 'Rien à traiter' }).text()).toContain('Rien à traiter')
  })

  it('colonnes de la maquette', () => {
    const heads = mountTable([rich()]).findAll('th').map(t => t.text())
    expect(heads).toEqual(['À faire', 'Colis', 'Expéditeur → Voyageur', 'Montant', 'Méthode', 'Depuis'])
  })

  it('À faire : statut + étiquette d’alerte par code', () => {
    const w = mountTable([rich(), rich({ id: 'p-cb', alert: 'CHARGEBACK_OPEN' }), rich({ id: 'p-none', alert: null })])
    expect(w.find(`[data-test="payment-row-${PAY}"] [data-test="payment-alert"]`).text()).toBe('Séquestre > 48 h')
    expect(w.find(`[data-test="payment-row-${PAY}"]`).text()).toContain('Sous séquestre')
    expect(w.find('[data-test="payment-row-p-cb"] [data-test="payment-alert"]').text()).toBe('Litige bancaire')
    expect(w.find('[data-test="payment-row-p-none"] [data-test="payment-alert"]').exists()).toBe(false)
  })

  it('versement retenu : un seul badge « Versement retenu », même avec l’alerte HELD', () => {
    const w = mountTable([rich({ alert: 'HELD', beneficiaryHeld: true, payoutHeldAt: '2026-10-20T10:00:00' })])
    const row = w.find(`[data-test="payment-row-${PAY}"]`)
    expect(w.find(`[data-test="payment-held-${PAY}"]`).text()).toBe('Versement retenu')
    expect(row.find('[data-test="payment-alert"]').exists()).toBe(false)
    // Alerte HELD sans les champs de retenue (back partiel) : l'étiquette d'alerte reste.
    const w2 = mountTable([rich({ alert: 'HELD' })])
    expect(w2.find('[data-test="payment-alert"]').text()).toBe('Retenu')
  })

  it('ligne de l’alerte la plus urgente (HELD) teintée', () => {
    const w = mountTable([rich({ alert: 'HELD' }), rich({ id: 'p-j48' })])
    expect(w.find(`[data-test="payment-row-${PAY}"]`).classes()).toContain('bg-danger/5')
    expect(w.find('[data-test="payment-row-p-j48"]').classes()).not.toContain('bg-danger/5')
  })

  it('Colis : trajet et n° de suivi sont des liens vers la fiche colis avec BID_VIEW', () => {
    const w = mountTable([rich()])
    const route = w.find(`[data-test="payment-route-${PAY}"]`)
    const tracking = w.find(`[data-test="payment-tracking-${PAY}"]`)
    expect(route.element.tagName).toBe('A')
    expect(route.attributes('href')).toBe(`/colis?open=${BID}`)
    expect(route.text()).toBe('Paris → Dakar')
    expect(tracking.element.tagName).toBe('A')
    expect(tracking.attributes('href')).toBe(`/colis?open=${BID}`)
    expect(tracking.text()).toBe('YD-8F3K2Q')
    expect(w.find(`[data-test="payment-row-${PAY}"]`).text()).toContain('Colis')
  })

  it('Colis : identifiant de colis de la ligne quand `insight` n’en donne pas', () => {
    const w = mountTable([rich({ insight: insight({ bidId: null }), bidId: BID })])
    expect(w.find(`[data-test="payment-tracking-${PAY}"]`).attributes('href')).toBe(`/colis?open=${BID}`)
  })

  it('Colis : sans BID_VIEW, du texte, aucun <a>', () => {
    seedAuth('ADMIN', { BID_VIEW: false })
    const w = mountTable([rich()])
    const row = w.find(`[data-test="payment-row-${PAY}"]`)
    expect(w.find(`[data-test="payment-route-${PAY}"]`).element.tagName).not.toBe('A')
    expect(w.find(`[data-test="payment-tracking-${PAY}"]`).element.tagName).not.toBe('A')
    expect(row.text()).toContain('Paris → Dakar')
    expect(row.text()).toContain('YD-8F3K2Q')
    expect(row.findAll('a').every(a => !a.attributes('href')?.startsWith('/colis'))).toBe(true)
  })

  it('négociation sans colis : étiquette « Négociation », aucun lien colis, fil raccourci', () => {
    const w = mountTable([rich({ insight: insight({ kind: 'NEGOTIATION', bidId: null, negotiationThreadId: '5d1cabcd-0000' }), trackingNumber: null, alert: null })])
    const row = w.find(`[data-test="payment-row-${PAY}"]`)
    expect(row.text()).toContain('Négociation')
    expect(row.text()).toContain('fil 5d1cabcd')
    expect(row.findAll('a').some(a => a.attributes('href')?.startsWith('/colis'))).toBe(false)
    expect(row.text()).not.toContain('undefined')
  })

  it('identifiant de colis qui n’est pas un UUID (ancien back) : texte, pas de lien', () => {
    const w = mountTable([{ ...payments[0]!, insight: undefined }])
    expect(w.find('[data-test="payment-row-p1"]').findAll('a')).toHaveLength(0)
    expect(w.find('[data-test="payment-row-p1"]').text()).toContain('colis b1')
  })

  it('noms : liens vers la fiche utilisateur avec USER_VIEW', () => {
    const w = mountTable([rich()])
    const sender = w.find(`[data-test="payment-sender-${PAY}"]`)
    const traveler = w.find(`[data-test="payment-traveler-${PAY}"]`)
    expect(sender.element.tagName).toBe('A')
    expect(sender.attributes('href')).toBe(`/users/${SENDER}`)
    expect(sender.text()).toBe('Awa Diallo')
    expect(traveler.attributes('href')).toBe(`/users/${TRAVELER}`)
  })

  it('noms : sans USER_VIEW, du texte', () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    const w = mountTable([rich()])
    expect(w.find(`[data-test="payment-sender-${PAY}"]`).element.tagName).not.toBe('A')
    expect(w.find(`[data-test="payment-sender-${PAY}"]`).text()).toBe('Awa Diallo')
    expect(w.find(`[data-test="payment-row-${PAY}"]`).findAll('a').some(a => a.attributes('href')?.startsWith('/users'))).toBe(false)
  })

  it('compte supprimé (partie sans identifiant) : tiret, pas de lien', () => {
    const w = mountTable([rich({ insight: insight({ traveler: null }) })])
    expect(w.find(`[data-test="payment-traveler-${PAY}"]`).element.tagName).not.toBe('A')
    expect(w.find(`[data-test="payment-traveler-${PAY}"]`).text()).toBe('—')
  })

  it('cliquer sur un lien n’émet pas select ; ailleurs sur la ligne, si', async () => {
    const w = mountTable([rich()])
    for (const t of ['route', 'tracking', 'sender', 'traveler']) {
      await w.find(`[data-test="payment-${t}-${PAY}"]`).trigger('click')
    }
    expect(w.emitted('select')).toBeUndefined()
    await w.find(`[data-test="payment-amount-${PAY}"]`).trigger('click')
    expect(w.emitted('select')).toEqual([[PAY]])
  })

  it('Montant : net voyageur et commission sous le montant', () => {
    const w = mountTable([rich()])
    expect(w.find(`[data-test="payment-amount-${PAY}"]`).text()).toBe(formatMoney(21300, 'EUR'))
    const split = w.find(`[data-test="payment-split-${PAY}"]`).text()
    expect(split).toContain(`net voyageur ${formatMoney(19440, 'EUR')}`)
    expect(split).toContain(`commission ${formatMoney(1860, 'EUR')}`)
    // Ancien back : commission seule.
    expect(mountTable(payments).find('[data-test="payment-split-p1"]').text()).toBe(`commission ${formatMoney(1480, 'EUR')}`)
  })

  describe('Depuis', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T10:00:00Z')) })
    afterEach(() => { vi.useRealTimers() })
    it('ancienneté relative et date courte', () => {
      const w = mountTable([rich()])
      const age = w.find(`[data-test="payment-age-${PAY}"]`).text()
      expect(age).toContain('il y a 4 j')
      expect(age).toContain('19 oct.')
    })
  })
})
