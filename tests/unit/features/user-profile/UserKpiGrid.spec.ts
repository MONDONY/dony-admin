import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserKpiGrid from '@/features/user-profile/components/UserKpiGrid.vue'
import type { UserOverviewKpis } from '@/features/user-profile/types/index'

const NULLS: UserOverviewKpis = {
  parcelsInProgress: null, activeTrips: null, heldByCurrency: null, openDisputes: null, totalDisputes: null,
  reportsReceived: null, reportsSent: null, reportsPending: null, averageRating: null, ratingCount: null,
}
const cards = (w: ReturnType<typeof mount>) => w.findAll('[data-test^="kpi-"]').map(c => c.attributes('data-test'))

describe('UserKpiGrid', () => {
  it('tout null : aucune carte', () => {
    expect(cards(mount(UserKpiGrid, { props: { kpis: NULLS } }))).toEqual([])
  })
  it('zéro est affiché (distinct de null)', () => {
    const w = mount(UserKpiGrid, { props: { kpis: { ...NULLS, parcelsInProgress: 0 } } })
    expect(cards(w)).toEqual(['kpi-parcels'])
    expect(w.get('[data-test="kpi-parcels"]').text()).toContain('0')
  })
  it('deux devises : deux lignes, jamais de somme', () => {
    const w = mount(UserKpiGrid, { props: { kpis: { ...NULLS, heldByCurrency: [
      { currency: 'EUR', amountCents: 12000 }, { currency: 'XOF', amountCents: 5000000 },
    ] } } })
    const lines = w.findAll('[data-test="kpi-held-line"]')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.text()).toContain('120')
  })
  it('argent retenu vide : carte avec « Aucun »', () => {
    const w = mount(UserKpiGrid, { props: { kpis: { ...NULLS, heldByCurrency: [] } } })
    expect(w.get('[data-test="kpi-held"]').text()).toContain('Aucun')
  })
  it('litiges, signalements et note', () => {
    const w = mount(UserKpiGrid, { props: { kpis: { ...NULLS, activeTrips: 2, openDisputes: 1, totalDisputes: 3, reportsReceived: 4, reportsPending: 1, averageRating: 4.6, ratingCount: 12 } } })
    expect(cards(w)).toEqual(['kpi-trips', 'kpi-disputes', 'kpi-reports', 'kpi-rating'])
    expect(w.get('[data-test="kpi-rating"]').text()).toContain('4,6 / 5')
    expect(w.get('[data-test="kpi-rating"]').text()).toContain('12')
    expect(w.get('[data-test="kpi-disputes"]').text()).toContain('3')
    expect(w.get('[data-test="kpi-reports"]').text()).toContain('1 en attente')
  })
  it('note sans effectif et signalements sans file', () => {
    const w = mount(UserKpiGrid, { props: { kpis: { ...NULLS, averageRating: 5, reportsReceived: 1 } } })
    expect(w.get('[data-test="kpi-rating"]').text()).toContain('5,0 / 5')
    expect(w.get('[data-test="kpi-reports"]').text()).not.toContain('en attente')
  })
})
