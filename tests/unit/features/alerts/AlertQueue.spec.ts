import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AlertQueue from '@/features/alerts/components/AlertQueue.vue'
import { groupAlerts } from '@/features/alerts/lib/alertWorkbench'
import type { AdminAlert } from '@/features/alerts/types/index'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const DAY = 24 * 3_600_000
const iso = (ago: number) => new Date(NOW - ago).toISOString()
function alert(id: string, over: Partial<AdminAlert> = {}): AdminAlert {
  return { id, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: `Paiement ${id}`, payload: {}, resolved: false, resolvedAt: null, createdAt: iso(3 * DAY), ...over }
}

function mountQueue(alerts: AdminAlert[], props: Record<string, unknown> = {}) {
  return mount(AlertQueue, { props: { groups: groupAlerts(alerts), loading: false, now: NOW, ...props } })
}

describe('AlertQueue', () => {
  it('une alerte seule : titre, sévérité, catégorie et âge', () => {
    const w = mountQueue([alert('a1', { severity: 'CRITICAL', type: 'RETURN_DEADLINE_EXPIRED', createdAt: iso(2 * DAY) })])
    const row = w.get('[data-test="alert-row-a1"]')
    expect(row.text()).toContain('Colis non rendu après annulation')
    expect(row.text()).toContain('Critique')
    expect(row.text()).toContain('2 j')
    expect(w.find('[data-test^="alert-group-toggle"]').exists()).toBe(false)
  })

  it('plusieurs alertes du même type : un groupe ×N replié, déplié à la demande', async () => {
    const alerts = [alert('a1'), alert('a2'), alert('a3', { type: 'RETURN_DEADLINE_EXPIRED' })]
    const w = mountQueue(alerts)
    const toggle = w.get('[data-test^="alert-group-toggle-"]')
    expect(toggle.text()).toContain('×2')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(false)
    await toggle.trigger('click')
    expect(w.emitted('toggle')![0]).toEqual([expect.stringContaining('séquestre')])
    await w.setProps({ expanded: [w.emitted('toggle')![0]![0] as string] })
    expect(w.find('[data-test="alert-row-a1"]').exists()).toBe(true)
    expect(w.find('[data-test="alert-row-a2"]').exists()).toBe(true)
  })

  it('le groupe de l’alerte ouverte est déplié d’office et la marque', () => {
    const w = mountQueue([alert('a1'), alert('a2')], { selectedId: 'a2' })
    expect(w.get('[data-test="alert-row-a2"]').attributes('data-selected')).toBe('true')
    expect(w.get('[data-test="alert-open-a2"]').attributes('aria-current')).toBe('true')
    expect(w.get('[data-test="alert-row-a1"]').attributes('data-selected')).toBeUndefined()
  })

  it('un clic sur une alerte la sélectionne, seule ou dans un groupe', async () => {
    const w = mountQueue([alert('a1'), alert('a2'), alert('b1', { type: 'RETURN_DEADLINE_EXPIRED' })], { selectedId: 'a1' })
    await w.get('[data-test="alert-open-a2"]').trigger('click')
    await w.get('[data-test="alert-open-b1"]').trigger('click')
    expect(w.emitted('select')).toEqual([['a2'], ['b1']])
  })

  it('une alerte résolue est marquée au lieu d’afficher un âge, seule ou en groupe', () => {
    const w = mountQueue([
      alert('a1', { resolved: true, resolvedAt: iso(DAY) }),
      alert('b1', { type: 'RETURN_DEADLINE_EXPIRED', resolved: true, resolvedAt: iso(DAY) }),
      alert('b2', { type: 'RETURN_DEADLINE_EXPIRED' }),
    ], { selectedId: 'b1' })
    expect(w.get('[data-test="alert-row-a1"]').text()).toContain('Résolue')
    expect(w.get('[data-test="alert-row-b1"]').text()).toContain('Résolue')
    expect(w.get('[data-test="alert-row-b2"]').text()).not.toContain('Résolue')
  })

  it('liste vide : « Aucune alerte » ; erreur : relance', async () => {
    expect(mountQueue([]).text()).toContain('Aucune alerte')
    const w = mountQueue([], { error: 'Impossible de charger les alertes' })
    expect(w.text()).toContain('Impossible de charger les alertes')
    await w.find('button').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('info : bordure d’accent', () => {
    const w = mountQueue([alert('i1', { severity: 'INFO' })])
    expect(w.get('[data-test="alert-open-i1"]').classes()).toContain('border-l-primary')
  })
})
