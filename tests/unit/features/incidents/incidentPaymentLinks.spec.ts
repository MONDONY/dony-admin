/**
 * Incidents → Transactions : « Voir le paiement de ce colis » mène à la liste filtrée sur le colis
 * (`/transactions?bidId=<colis>&view=ALL`), seulement avec PAYMENT_VIEW ; sans elle, aucun `<a>`.
 * Le lien vers le colis passe par le registre (BID_VIEW). Même contrat pour un litige et pour une absence.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import IncidentCase from '@/features/incidents/components/IncidentCase.vue'
import { disputeIncident, noShowIncident, type Incident } from '@/features/incidents/lib/incidentWorkbench'
import { seedAuth } from '~/tests/helpers/auth'
import { BID_ID, dispute, noShow, NuxtLink } from './noShowFixtures'

const mountCase = (incident: Incident) => mount(IncidentCase, { props: { incident }, global: { stubs: { NuxtLink } } })
const KINDS: [string, (_bidId: string) => Incident][] = [
  ['litige', (bidId) => disputeIncident(dispute({ bidId }))],
  ['absence', (bidId) => noShowIncident(noShow({ bidId }))],
]

describe.each(KINDS)('IncidentCase (%s) : colis et paiement du colis', (_label, build) => {
  beforeEach(() => seedAuth('ADMIN'))

  it('liens vers le colis et vers ses paiements avec les droits de lecture', () => {
    const w = mountCase(build(BID_ID))
    expect(w.get('[data-test="incident-bid-link"]').attributes('href')).toBe(`/colis?open=${BID_ID}`)
    const a = w.get('[data-test="incident-payment-link"]')
    expect(a.element.tagName).toBe('A')
    expect(a.attributes('href')).toBe(`/transactions?bidId=${BID_ID}&view=ALL`)
    expect(a.text()).toBe('Voir le paiement de ce colis')
  })

  it('sans PAYMENT_VIEW : pas de lien paiement ; sans BID_VIEW : le colis reste lisible, sans lien', () => {
    seedAuth('ADMIN', { PAYMENT_VIEW: false, BID_VIEW: false })
    const w = mountCase(build(BID_ID))
    expect(w.find('[data-test="incident-payment-link"]').exists()).toBe(false)
    expect(w.find('[data-test="incident-bid-link"]').exists()).toBe(false)
    expect(w.get('[data-test="incident-bid-text"]').text()).toContain('Colis 89125c9c')
  })

  it('colis mal formé : aucun lien, pas de « undefined »', () => {
    const w = mountCase(build('bid-1'))
    expect(w.find('[data-test="incident-payment-link"]').exists()).toBe(false)
    expect(w.find('[data-test="incident-bid-link"]').exists()).toBe(false)
    expect(w.html()).not.toContain('undefined')
  })
})
