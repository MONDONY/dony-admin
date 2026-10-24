import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import ChargebacksTable from '@/features/payments/components/ChargebacksTable.vue'
import { toHref, type AdminRoute } from '@/lib/adminLinks'
import type { AdminChargeback } from '@/features/payments/types/index'

const NuxtLink = {
  name: 'NuxtLink', props: ['to'],
  setup(p: { to: string | AdminRoute }) { return { href: computed(() => (typeof p.to === 'string' ? p.to : toHref(p.to))) } },
  template: '<a :href="href"><slot /></a>',
}
const CB = 'cccccccc-1111-4222-8333-444444444444'
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const P = 'bbbbbbbb-1111-4222-8333-444444444444'
const S = '11111111-2222-4333-8444-555555555555'
const T = '22222222-3333-4444-8555-666666666666'
const enriched = (over: Partial<AdminChargeback> = {}): AdminChargeback => ({
  id: CB, bidId: B, amountCents: 35100, currency: 'EUR', reason: 'fraudulent', status: 'OPEN', openedAt: '2026-10-21T10:00:00',
  paymentId: P, trackingNumber: 'YD-7LQ2WA', corridor: 'Marseille → Bamako', senderId: S, senderName: 'Fatou Sow', travelerId: T, travelerName: 'Oumar Keita', ...over,
})
const old = { id: 'cb1', bidId: 'b1', amountCents: 5000, currency: 'EUR', reason: 'fraudulent', status: 'OPEN', openedAt: '2026-06-01T10:00:00Z' } as AdminChargeback
const mountTable = (chargebacks: AdminChargeback[], props: Record<string, unknown> = {}) =>
  mount(ChargebacksTable, { props: { chargebacks, loading: false, ...props }, global: { stubs: { NuxtLink } }, attachTo: document.body })

describe('ChargebacksTable', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('renders rows', () => { expect(mountTable([old]).find('[data-test="cb-row-cb1"]').exists()).toBe(true) })
  it('affiche le montant dans la devise du litige, un chargeback existe aussi en dollars', () => {
    const w = mountTable([{ ...old, id: 'cb2', currency: 'CAD', amountCents: 12345 }])
    expect(w.find('[data-test="cb-amount-cb2"]').text()).toBe('123,45 CAD')
    expect(w.find('[data-test="cb-amount-cb1"]').exists()).toBe(false)
  })
  it('empty state', () => { expect(mountTable([]).text()).toMatch(/Aucun litige bancaire/i) })
  it('loading state', () => { expect(mountTable([], { loading: true }).text()).toMatch(/Chargement/i) })
  it('renders placeholders for missing optional values', () => {
    const w = mountTable([{ ...old, bidId: null, reason: null }])
    expect(w.text()).toContain('—')
  })

  it('colonnes du nouveau back : Colis, Expéditeur → Voyageur, Montant, Motif, Statut, Ouvert', () => {
    expect(mountTable([enriched()]).findAll('th').map(t => t.text())).toEqual(['Colis', 'Expéditeur → Voyageur', 'Montant', 'Motif', 'Statut', 'Ouvert'])
  })
  it('liens : colis (trajet, suivi), personnes, « Ouvrir le paiement » ; motif et statut en clair ; aucun UUID', () => {
    const w = mountTable([enriched()])
    expect(w.find(`[data-test="cb-route-${CB}"]`).attributes('href')).toBe(`/colis?open=${B}`)
    expect(w.find(`[data-test="cb-tracking-${CB}"]`).attributes('href')).toBe(`/colis?open=${B}`)
    expect(w.find(`[data-test="cb-sender-${CB}"]`).attributes('href')).toBe(`/users/${S}`)
    expect(w.find(`[data-test="cb-traveler-${CB}"]`).attributes('href')).toBe(`/users/${T}`)
    expect(w.find(`[data-test="cb-payment-${CB}"]`).attributes('href')).toBe(`/transactions?open=${P}`)
    const text = w.find(`[data-test="cb-row-${CB}"]`).text()
    for (const s of ['Marseille → Bamako', 'YD-7LQ2WA', 'Fatou Sow', 'Oumar Keita', '351,00 EUR', 'Fraude présumée', 'Ouvert', 'Ouvrir le paiement']) expect(text).toContain(s)
    for (const id of ['cccccccc', 'aaaaaaaa', 'bbbbbbbb', '11111111', '22222222']) expect(text).not.toContain(id)
  })
  it('sans BID_VIEW, USER_VIEW ni PAYMENT_VIEW : textes, aucun lien', () => {
    seedAuth('ADMIN', { BID_VIEW: false, USER_VIEW: false, PAYMENT_VIEW: false })
    const w = mountTable([enriched()])
    expect(w.findAll('a')).toHaveLength(0)
    expect(w.text()).toContain('Fatou Sow')
    expect(w.text()).not.toContain('Ouvrir le paiement')
  })
  it('personne au compte supprimé : identifiant abrégé en texte ; aucune personne : tiret', () => {
    const w = mountTable([enriched({ senderName: null }), enriched({ id: 'x2', senderId: null, senderName: null, travelerId: null, travelerName: null })])
    expect(w.find(`[data-test="cb-sender-${CB}"]`).element.tagName).toBe('SPAN')
    expect(w.find(`[data-test="cb-sender-${CB}"]`).text()).toBe('11111111')
    expect(w.find('[data-test="cb-parties-x2"]').text()).toBe('—')
  })
  it('litige tranché : issue et date de décision', () => {
    const w = mountTable([enriched({ status: 'LOST', outcome: 'warning_closed', resolvedAt: '2026-10-23T09:00:00' })])
    const text = w.find(`[data-test="cb-status-${CB}"]`).text()
    expect(text).toContain('Perdu')
    expect(text).toContain('Issue : warning_closed')
    expect(text).toContain('Tranché le 23 oct.')
  })
  it('ancien back : colonnes d’avant, identifiant de colis abrégé, ni personnes ni lien de paiement', () => {
    const w = mountTable([old])
    expect(w.findAll('th').map(t => t.text())).toEqual(['Colis', 'Montant', 'Motif', 'Statut', 'Ouvert'])
    expect(w.find('[data-test="cb-bid-cb1"]').text()).toBe('b1')
    expect(w.text()).not.toContain('undefined')
    expect(w.text()).not.toContain('Ouvrir le paiement')
  })
  it('ligne ouverte (`highlightId`) : mise en évidence et amenée à l’écran', async () => {
    const spy = vi.fn()
    Element.prototype.scrollIntoView = spy
    const w = mountTable([enriched(), enriched({ id: 'x2' })], { highlightId: CB })
    await nextTick(); await flushPromises()
    const row = w.find(`[data-test="cb-row-${CB}"]`)
    expect(row.attributes('aria-current')).toBe('true')
    expect(w.find('[data-test="cb-row-x2"]').attributes('aria-current')).toBeUndefined()
    expect(spy).toHaveBeenCalledTimes(1)
    w.unmount()
  })
  it('liste en échec : pas d’état vide', () => {
    expect(mountTable([], { failed: true }).text()).not.toMatch(/Aucun litige/)
  })
})
