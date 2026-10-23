import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserOverviewTab from '@/features/user-profile/components/UserOverviewTab.vue'
import type { InProgressItem, TimelineEntry } from '@/features/user-profile/types/index'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }
const item = (o: Partial<InProgressItem> = {}): InProgressItem => ({
  kind: 'PARCEL', id: 'b1', reference: 'DNY-001', corridor: 'Paris → Dakar', role: 'SENDER', status: 'IN_TRANSIT',
  updatedAt: '2026-10-20T10:30:00Z', amount: { currency: 'EUR', amountCents: 4500 }, ...o,
})
const ev = (o: Partial<TimelineEntry> = {}): TimelineEntry => ({
  kind: 'PARCEL', title: 'Colis remis', detail: 'DNY-001', at: '2026-10-20T10:30:00Z', refType: 'PARCEL', refId: 'b1', ...o,
})
const mountTab = (inProgress: InProgressItem[] | null, timeline: TimelineEntry[] | null) =>
  mount(UserOverviewTab, { props: { inProgress, timeline }, global: { stubs } })

describe('UserOverviewTab', () => {
  it('null : tableau et frise masqués, jamais « Aucun »', () => {
    const w = mountTab(null, null)
    expect(w.find('[data-test="in-progress-card"]').exists()).toBe(false)
    expect(w.find('[data-test="timeline-card"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Aucun')
    expect(w.text()).not.toContain('Rien en cours')
  })

  it('listes vides : messages dédiés', () => {
    const w = mountTab([], [])
    expect(w.get('[data-test="in-progress-card"]').text()).toContain('Rien en cours ni livré depuis 3 jours')
    expect(w.get('[data-test="timeline-card"]').text()).toContain('Aucune activité récente')
  })

  it('une carte masquée n’affecte pas l’autre', () => {
    const w = mountTab(null, [])
    expect(w.find('[data-test="in-progress-card"]').exists()).toBe(false)
    expect(w.find('[data-test="timeline-card"]').exists()).toBe(true)
  })

  it('lignes : type, référence, trajet, rôle, statut, montant, lien', () => {
    const w = mountTab([
      item(),
      item({ kind: 'TRIP', id: 't9', reference: 'TRJ-9', role: 'TRAVELER', status: 'ACTIVE', amount: null }),
    ], [])
    const rows = w.findAll('[data-test="in-progress-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Colis')
    expect(rows[0]!.text()).toContain('DNY-001')
    expect(rows[0]!.text()).toContain('Paris → Dakar')
    expect(rows[0]!.text()).toContain('Expéditeur')
    expect(rows[0]!.text()).toContain('En transit')
    expect(rows[0]!.text()).toContain('45,00 EUR')
    expect(rows[0]!.get('a').attributes('href')).toBe('/colis?open=b1')
    expect(rows[1]!.text()).toContain('Trajet')
    expect(rows[1]!.text()).toContain('Voyageur')
    expect(rows[1]!.text()).toContain('—')
    expect(rows[1]!.get('a').attributes('href')).toBe('/colis?tab=announcements&announcement=t9')
  })

  it('montants XOF et EUR chacun dans leur devise', () => {
    const w = mountTab([
      item({ amount: { currency: 'XOF', amountCents: 600000 } }),
      item({ id: 'b2', amount: { currency: 'EUR', amountCents: 1000 } }),
    ], null)
    const text = w.text().replace(/[\u202f\u00a0]/g, ' ')
    expect(text).toContain('6 000,00 XOF')
    expect(text).toContain('10,00 EUR')
  })

  it('statut inconnu : affiché brut en neutre, rôle inconnu brut', () => {
    const w = mountTab([item({ status: 'WEIRD_STATE', role: 'OBSERVER' })], null)
    const row = w.get('[data-test="in-progress-row"]')
    expect(row.text()).toContain('WEIRD_STATE')
    expect(row.text()).toContain('OBSERVER')
  })

  it('type inconnu : pas de lien Ouvrir', () => {
    const w = mountTab([item({ kind: 'OTHER' as never, status: 'ACTIVE' })], null)
    expect(w.get('[data-test="in-progress-row"]').find('a').exists()).toBe(false)
  })

  it('frise : ordre reçu, liens selon le type, sans lien si refId null', () => {
    const w = mountTab(null, [
      ev({ title: 'Premier' }),
      ev({ kind: 'PAYMENT', title: 'Second', refType: 'PAYMENT', refId: 'p1' }),
      ev({ kind: 'DISPUTE', title: 'Troisième', refType: 'DISPUTE', refId: 'd1' }),
      ev({ kind: 'REPORT', title: 'Quatrième', refType: 'REPORT', refId: 'r1' }),
      ev({ title: 'Sans lien', refId: null }),
    ])
    const items = w.findAll('[data-test="timeline-entry"]')
    expect(items.map(i => i.get('[data-test="timeline-title"]').text()))
      .toEqual(['Premier', 'Second', 'Troisième', 'Quatrième', 'Sans lien'])
    expect(items.map(i => i.find('a').exists() ? i.get('a').attributes('href') : null)).toEqual([
      '/colis?open=b1', '/transactions?open=p1', '/incidents?open=d1', '/signalements?open=r1', null,
    ])
    expect(items[0]!.text()).toContain('DNY-001')
    expect(items[0]!.get('[data-test="timeline-dot"]').classes()).toContain('bg-primary')
    expect(items[1]!.get('[data-test="timeline-dot"]').classes()).toContain('bg-success')
    expect(items[2]!.get('[data-test="timeline-dot"]').classes()).toContain('bg-danger')
    expect(items[3]!.get('[data-test="timeline-dot"]').classes()).toContain('bg-warning')
  })

  it('date en fuseau Paris', () => {
    const w = mountTab(null, [ev({ at: '2026-10-20T22:30:00Z' })])
    expect(w.get('[data-test="timeline-entry"]').text()).toMatch(/21\/10\/2026/)
  })

  it('le type de chaque entrée est nommé en texte, pas seulement par la couleur', () => {
    const w = mountTab(null, [
      ev(), ev({ kind: 'PAYMENT' }), ev({ kind: 'DISPUTE' }), ev({ kind: 'REPORT' }),
    ])
    expect(w.findAll('[data-test="timeline-kind"]').map(k => k.text()))
      .toEqual(['Colis', 'Paiement', 'Litige', 'Signalement'])
  })

  it('type inconnu : point neutre et libellé brut', () => {
    const w = mountTab(null, [ev({ kind: 'MYSTERY' as never, refType: null })])
    expect(w.get('[data-test="timeline-dot"]').classes()).toContain('bg-border')
    expect(w.get('[data-test="timeline-kind"]').text()).toBe('MYSTERY')
  })

  it('liens Ouvrir nommés avec la référence ou le titre, tableau nommé, colonnes scope=col', () => {
    const w = mountTab([item()], [ev({ title: 'Colis remis' })])
    expect(w.get('[data-test="in-progress-row"] a').attributes('aria-label')).toBe('Ouvrir DNY-001')
    expect(w.get('[data-test="timeline-entry"] a').attributes('aria-label')).toBe('Ouvrir Colis remis')
    expect(w.get('table').attributes('aria-label')).toContain('en cours')
    expect(w.findAll('th').every(h => h.attributes('scope') === 'col')).toBe(true)
  })

  it('listes absentes (undefined) : cartes masquées', () => {
    const w = mount(UserOverviewTab, { props: { inProgress: undefined as never, timeline: undefined as never }, global: { stubs } })
    expect(w.find('[data-test="in-progress-card"]').exists()).toBe(false)
    expect(w.find('[data-test="timeline-card"]').exists()).toBe(false)
  })

  it('trajet sans référence : libellé de repli et lien nommé d’après le trajet', () => {
    const trip = { ...item({ kind: 'TRIP', id: 't1', amount: undefined }), reference: undefined } as unknown as InProgressItem
    const w = mountTab([trip], [])
    const row = w.get('[data-test="in-progress-row"]')
    expect(row.text()).not.toContain('undefined')
    const cells = row.findAll('td')
    expect(cells[1]!.text()).toBe('Trajet')
    expect(row.get('a').attributes('aria-label')).toBe('Ouvrir le trajet Paris → Dakar')
    expect(cells[6]!.text()).toBe('—')
  })
})
