import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NoShowsTable from '@/features/incidents/components/NoShowsTable.vue'
import { noShow, NuxtLink } from './noShowFixtures'

const now = Date.parse('2026-09-28T10:00:00Z')
const mountTable = (rows = [noShow()], loading = false) =>
  mount(NoShowsTable, { props: { rows, loading, now }, global: { stubs: { NuxtLink } } })

describe('NoShowsTable', () => {
  it('une phrase lisible par ligne, sans UUID ni statut brut', () => {
    const text = mountTable().find('[data-test="noshow-row-c1"]').text()
    expect(text).toContain('Le voyageur Awa D. déclare l’expéditeur Moussa K. absent à la remise')
    expect(text).toContain('Départ')
    expect(text).toContain('Bamako → Abidjan, 15 sept.')
    expect(text).toContain('15 sept. à 14:30')
    expect(text).toMatch(/45,00 EUR · Espèces/)
    expect(text).toContain('En attente')
    expect(text).toContain('reste 5 h')
    expect(text).not.toContain('PENDING_CONFIRMATION')
    expect(text).not.toContain('89125c9c-aaaa')
  })

  it('temps restant en rouge sous 2 h, « échu » ensuite', () => {
    const w = mountTable([noShow({ id: 'a', remainingMinutes: 90 }), noShow({ id: 'b', remainingMinutes: -5 }), noShow({ id: 'c' })])
    expect(w.find('[data-test="noshow-remaining-a"]').classes()).toContain('text-danger')
    expect(w.find('[data-test="noshow-remaining-b"]').text()).toBe('échu')
    expect(w.find('[data-test="noshow-remaining-c"]').classes()).not.toContain('text-danger')
  })

  it('arrivée + litige lié : badge et lien vers le litige', () => {
    const w = mountTable([noShow({ scope: 'DELIVERY', status: 'CONFIRMED', dispute: { id: 'd1', status: 'OPEN' } })])
    expect(w.text()).toContain('Arrivée')
    const link = w.find('[data-test="noshow-dispute-c1"]')
    expect(link.attributes('href')).toBe('/incidents?tab=disputes&open=d1')
    expect(link.text()).toContain('Litige ouvert')
    expect(w.find('[data-test="noshow-remaining-c1"]').exists()).toBe(false)
  })

  it('clic ou Entrée sur une ligne : émet la ligne', async () => {
    const r = noShow()
    const w = mountTable([r])
    await w.find('[data-test="noshow-row-c1"]').trigger('click')
    await w.find('[data-test="noshow-row-c1"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select')).toEqual([[r], [r]])
  })

  it('ancien back : « Colis 89125c9c… » en titre, phrase déduite dessous, pas de badge de portée', () => {
    const w = mountTable([noShow({ legacy: true, scope: null, declarant: { role: 'TRAVELER', userId: 'u9' }, accused: { role: 'SENDER' }, trip: null, handoverAt: null, amount: null, paymentMethod: null })])
    const text = w.find('[data-test="noshow-row-c1"]').text()
    expect(text).toContain('Colis 89125c9c…')
    expect(text).toContain('Le voyageur déclare l’expéditeur absent à la remise')
    expect(text).not.toContain('Départ')
  })

  it('chargement et liste vide', () => {
    expect(mountTable([], true).text()).toContain('Chargement…')
    expect(mountTable([]).text()).toMatch(/Aucune déclaration/)
  })
})
