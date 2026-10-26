import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IncidentQueue from '@/features/incidents/components/IncidentQueue.vue'
import { disputeIncident, groupIncidents, noShowIncident } from '@/features/incidents/lib/incidentWorkbench'
import { dispute, noShow } from './noShowFixtures'

const NOW = Date.parse('2026-10-26T12:00:00Z')

function mountQueue(items: ReturnType<typeof disputeIncident>[], props: Record<string, unknown> = {}) {
  return mount(IncidentQueue, { props: { groups: groupIncidents(items, NOW), loading: false, now: NOW, ...props } })
}

describe('IncidentQueue', () => {
  it('un incident seul : nature, parties, statut et ancienneté', () => {
    const w = mountQueue([disputeIncident(dispute({ id: 'd1', createdAt: '2026-10-17T10:00:00' }))])
    const row = w.get('[data-test="incident-row-dispute:d1"]')
    expect(row.text()).toContain('Voyageur absent à la livraison')
    expect(row.text()).toContain('Koro DIAKITE → Ibra DIANE')
    expect(row.text()).toContain('Ouvert')
    expect(row.text()).toContain('Litige')
    expect(row.text()).toContain('9 j')
    expect(w.find('[data-test^="incident-group-toggle"]').exists()).toBe(false)
  })

  it('plusieurs incidents de même nature : groupe ×N, replié puis déplié à la demande', async () => {
    const items = [disputeIncident(dispute({ id: 'd1' })), disputeIncident(dispute({ id: 'd2' })), noShowIncident(noShow({ id: 'n1' }))]
    const w = mountQueue(items)
    const toggle = w.get('[data-test="incident-group-toggle-DISPUTE:Voyageur absent à la livraison"]')
    expect(toggle.text()).toContain('×2')
    expect(toggle.text()).toContain('Litiges')
    expect(w.find('[data-test="incident-open-dispute:d1"]').exists()).toBe(false)
    await toggle.trigger('click')
    expect(w.emitted('toggle')![0]).toEqual(['DISPUTE:Voyageur absent à la livraison'])
    await w.setProps({ expanded: ['DISPUTE:Voyageur absent à la livraison'] })
    expect(w.find('[data-test="incident-open-dispute:d1"]').exists()).toBe(true)
    expect(w.get('[data-test="incident-group-toggle-DISPUTE:Voyageur absent à la livraison"]').attributes('aria-expanded')).toBe('true')
  })

  it('le groupe de l’incident ouvert est déplié d’office et le marque', () => {
    const w = mountQueue([disputeIncident(dispute({ id: 'd1' })), disputeIncident(dispute({ id: 'd2' }))], { selectedKey: 'dispute:d2' })
    expect(w.get('[data-test="incident-row-dispute:d2"]').attributes('data-selected')).toBe('true')
    expect(w.get('[data-test="incident-open-dispute:d2"]').attributes('aria-current')).toBe('true')
    expect(w.get('[data-test="incident-row-dispute:d1"]').attributes('data-selected')).toBeUndefined()
  })

  it('un clic choisit l’incident, seul ou dans un groupe', async () => {
    const w = mountQueue([disputeIncident(dispute({ id: 'd1' })), noShowIncident(noShow({ id: 'n1', scope: 'DELIVERY' }))])
    await w.get('[data-test="incident-open-dispute:d1"]').trigger('click')
    await w.get('[data-test="incident-open-noshow:n1"]').trigger('click')
    expect(w.emitted('select')).toEqual([['dispute:d1'], ['noshow:n1']])
    const g = mountQueue([disputeIncident(dispute({ id: 'a' })), disputeIncident(dispute({ id: 'b' }))], { expanded: ['DISPUTE:Voyageur absent à la livraison'] })
    await g.get('[data-test="incident-open-dispute:b"]').trigger('click')
    expect(g.emitted('select')![0]).toEqual(['dispute:b'])
  })

  it('une absence en attente montre le temps qui reste', () => {
    const w = mountQueue([noShowIncident(noShow({ id: 'n1', remainingMinutes: 90 }))])
    expect(w.get('[data-test="incident-row-noshow:n1"]').text()).toContain('reste 1 h')
    expect(w.get('[data-test="incident-row-noshow:n1"]').text()).toContain('Absence')
  })

  it('un incident traité n’a pas d’ancienneté : « Traité », seul ou dans un groupe', () => {
    const single = mountQueue([disputeIncident(dispute({ id: 'd1', status: 'RESOLVED' }))])
    expect(single.get('[data-test="incident-row-dispute:d1"]').text()).toContain('Traité')
    const group = mountQueue([disputeIncident(dispute({ id: 'a', status: 'RESOLVED' })), disputeIncident(dispute({ id: 'b', status: 'RESOLVED' }))], { expanded: ['DISPUTE:Voyageur absent à la livraison'] })
    expect(group.get('[data-test="incident-row-dispute:a"]').text()).toContain('Traité')
  })

  it('une ligne secondaire : trajet d’une absence dans un groupe', () => {
    const w = mountQueue([noShowIncident(noShow({ id: 'a' })), noShowIncident(noShow({ id: 'b' }))], { expanded: ['NOSHOW:Déclaration d’absence à la remise'] })
    expect(w.get('[data-test="incident-row-noshow:a"]').text()).toContain('Bamako → Abidjan')
  })

  it('chargement, erreur et vide viennent du bloc d’état', async () => {
    const empty = mountQueue([])
    expect(empty.text()).toContain('Aucun incident')
    const failed = mountQueue([], { error: 'Boum' })
    expect(failed.text()).toContain('Boum')
    await failed.get('[data-test="state-error"] button').trigger('click')
    expect(failed.emitted('retry')).toBeTruthy()
    expect(mountQueue([], { loading: true }).text()).toContain('Chargement')
  })
})
