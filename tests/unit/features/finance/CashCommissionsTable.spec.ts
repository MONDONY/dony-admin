import { describe, it, expect, beforeEach } from 'vitest'
import { computed } from 'vue'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import CashCommissionsTable from '@/features/finance/components/CashCommissionsTable.vue'
import { toHref, type AdminRoute } from '@/lib/adminLinks'
import type { AdminCashCommission } from '@/features/finance/types/index'

const NuxtLink = {
  name: 'NuxtLink', props: ['to'],
  setup(p: { to: string | AdminRoute }) { return { href: computed(() => (typeof p.to === 'string' ? p.to : toHref(p.to))) } },
  template: '<a :href="href"><slot /></a>',
}
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const T = '22222222-3333-4444-8555-666666666666'
const row = (over: Partial<AdminCashCommission> = {}): AdminCashCommission => ({
  bidId: B, amountCents: 15000, commissionCents: 1800, currency: 'EUR', status: 'FAILED', chargedVia: 'CARD', retryCount: 2, createdAt: '2026-10-20T10:00:00',
  trackingNumber: 'YD-4PX9TN', corridor: 'Paris → Dakar', travelerId: T, travelerName: 'Oumar Keita', ...over,
})
const mountTable = (commissions: AdminCashCommission[], props: Record<string, unknown> = {}) =>
  mount(CashCommissionsTable, { props: { commissions, loading: false, ...props }, global: { stubs: { NuxtLink } } })

describe('CashCommissionsTable', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('colonnes : Colis, Voyageur, Montant, Commission, Statut, Canal, Tentatives, Créé', () => {
    expect(mountTable([row()]).findAll('th').map(t => t.text())).toEqual(['Colis', 'Voyageur', 'Montant', 'Commission', 'Statut', 'Canal', 'Tentatives', 'Créé'])
  })
  it('trajet et n° de suivi : liens vers le colis, onglet Argent ; voyageur : lien vers sa fiche ; aucun UUID visible', () => {
    const w = mountTable([row()])
    const money = `/colis?open=${B}&section=money`
    expect(w.find(`[data-test="cash-route-${B}"]`).attributes('href')).toBe(money)
    expect(w.find(`[data-test="cash-tracking-${B}"]`).attributes('href')).toBe(money)
    expect(w.find(`[data-test="cash-traveler-${B}"]`).attributes('href')).toBe(`/users/${T}`)
    const text = w.find(`[data-test="cash-commission-row-${B}"]`).text()
    for (const s of ['Paris → Dakar', 'YD-4PX9TN', 'Oumar Keita', '150,00 EUR', '18,00 EUR', 'Échouée', 'Carte', '2']) expect(text).toContain(s)
    expect(text).not.toContain('aaaaaaaa')
    expect(text).not.toContain('22222222')
  })
  it('sans BID_VIEW ni USER_VIEW : textes, aucun lien', () => {
    seedAuth('ADMIN', { BID_VIEW: false, USER_VIEW: false })
    const w = mountTable([row()])
    expect(w.findAll('a')).toHaveLength(0)
    expect(w.text()).toContain('YD-4PX9TN')
    expect(w.text()).toContain('Oumar Keita')
  })
  it('voyageur au compte supprimé : identifiant abrégé en texte simple', () => {
    const w = mountTable([row({ travelerName: null })])
    const cell = w.find(`[data-test="cash-traveler-${B}"]`)
    expect(cell.element.tagName).toBe('SPAN')
    expect(cell.text()).toBe('22222222')
  })
  it('colis sans trajet ni suivi : identifiant abrégé relié au colis', () => {
    const w = mountTable([row({ corridor: null, trackingNumber: null })])
    const a = w.find(`[data-test="cash-bid-${B}"]`)
    expect(a.text()).toBe('aaaaaaaa')
    expect(a.attributes('href')).toBe(`/colis?open=${B}&section=money`)
  })
  it('ancien back : colonnes d’avant (pas de Voyageur), identifiant abrégé, jamais « undefined »', () => {
    const old = { bidId: 'b1', amountCents: 25000, commissionCents: 3000, currency: 'EUR', status: 'CHARGED', chargedVia: 'WALLET', retryCount: 0, createdAt: '2026-06-01T10:00:00Z' } as AdminCashCommission
    const w = mountTable([old])
    expect(w.findAll('th').map(t => t.text())).not.toContain('Voyageur')
    expect(w.find('[data-test="cash-bid-b1"]').text()).toBe('b1')
    expect(w.find('[data-test="cash-bid-b1"]').element.tagName).toBe('SPAN')
    expect(w.text()).not.toContain('undefined')
  })
  it('état vide seulement sans erreur, libellé fourni', () => {
    expect(mountTable([], { emptyLabel: 'Rien à traiter' }).text()).toContain('Rien à traiter')
    expect(mountTable([], { failed: true }).text()).not.toMatch(/Aucune commission/)
  })
})
