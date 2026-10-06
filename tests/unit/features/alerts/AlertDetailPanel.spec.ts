import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import type { AdminAlert } from '@/features/alerts/types/index'

const svc = vi.hoisted(() => ({ violations: vi.fn() }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))

import AlertDetailPanel from '@/features/alerts/components/AlertDetailPanel.vue'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="JSON.stringify(to)"><slot /></a>' }
const P = '11111111-2222-3333-4444-555555555555'

function alert(over: Partial<AdminAlert> = {}): AdminAlert {
  return {
    id: 'a1', type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: 'Paiement en séquestre depuis plus de 48 h',
    payload: { paymentId: P, amount: '42.00' }, resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00', ...over,
  }
}

function mountPanel(a: AdminAlert | null) {
  return mount(AlertDetailPanel, { props: { alert: a }, global: { stubs: { NuxtLink } } })
}

describe('AlertDetailPanel', () => {
  beforeEach(() => { seedAuth('ADMIN'); svc.violations.mockReset() })

  it('rien quand aucune alerte n’est sélectionnée', () => {
    expect(mountPanel(null).find('[data-test="alert-detail"]').exists()).toBe(false)
  })

  it('titre, explication, étapes, liens et données en clair', () => {
    const w = mountPanel(alert())
    expect(w.find('[data-test="alert-detail-title"]').text()).toBe('Paiement en séquestre depuis plus de 48 h')
    expect(w.find('[data-test="alert-detail-actions"]').findAll('li').length).toBeGreaterThan(2)
    expect(w.find('[data-test="alert-link-transactions"]').text()).toBe('Ouvrir le paiement')
    expect(w.find('[data-test="alert-detail-facts"]').text()).toContain('Montant')
    expect(svc.violations).not.toHaveBeenCalled()
  })

  it('émet resolve et close', async () => {
    const w = mountPanel(alert())
    await w.find('[data-test="alert-detail-resolve"]').trigger('click')
    await w.find('[data-test="alert-detail-close"]').trigger('click')
    expect(w.emitted('resolve')![0]).toEqual(['a1'])
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('pas de bouton résoudre sur une alerte déjà résolue', () => {
    const w = mountPanel(alert({ resolved: true, resolvedAt: '2026-10-06T13:00:00Z' }))
    expect(w.find('[data-test="alert-detail-resolve"]').exists()).toBe(false)
    expect(w.text()).toContain('Résolue le')
  })

  it('règle de cohérence : recalcule et montre les lignes en faute avec liens', async () => {
    svc.violations.mockResolvedValue({ invariant: 'INV-05', title: 't', severity: 'CRITIQUE', total: 3, rows: [{ payment_id: P, anomaly: 'X' }] })
    const w = mountPanel(alert({ type: 'MONEY_INVARIANT_INV-05', detail: null, payload: { lignesEnFaute: 3 } }))
    await flushPromises()
    expect(svc.violations).toHaveBeenCalledWith('a1')
    expect(w.find('[data-test="alert-violations-total"]').text()).toContain('3 ligne(s) en faute (1 affichées)')
    expect(w.find('[data-test="alert-rows"]').html()).toContain('/transactions')
  })

  it('règle de cohérence corrigée : invite à résoudre', async () => {
    svc.violations.mockResolvedValue({ invariant: 'INV-14', title: 't', severity: 'MOYENNE', total: 0, rows: [] })
    const w = mountPanel(alert({ type: 'MONEY_INVARIANT_INV-14' }))
    await flushPromises()
    expect(w.find('[data-test="alert-violations-clear"]').exists()).toBe(true)
  })

  it('recalcul en échec : erreur affichée et extrait de la levée en secours', async () => {
    svc.violations.mockRejectedValue(new Error('boom'))
    const w = mountPanel(alert({ type: 'MONEY_INVARIANT_INV-01', payload: { exemples: [{ user_id: P, drift: 10 }] } }))
    await flushPromises()
    expect(w.find('[data-test="alert-violations-error"]').exists()).toBe(true)
    expect(w.text()).toContain('Exemples au moment de l’alerte')
    expect(w.find('[data-test="alert-rows"]').text()).toContain('10')
  })

  it('« Recalculer » relance la règle', async () => {
    svc.violations.mockResolvedValue({ invariant: 'INV-14', title: 't', severity: 'MOYENNE', total: 0, rows: [] })
    const w = mountPanel(alert({ type: 'MONEY_INVARIANT_INV-14' }))
    await flushPromises()
    await w.find('[data-test="alert-violations-refresh"]').trigger('click')
    await flushPromises()
    expect(svc.violations).toHaveBeenCalledTimes(2)
  })
})
