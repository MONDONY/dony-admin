import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({ refunds: vi.fn(), anomalies: vi.fn() }))
vi.mock('@/features/dac7/services/dac7Service', () => ({ dac7Service: svc }))

import Dac7RefundsPanel from '@/features/dac7/components/Dac7RefundsPanel.vue'
import Dac7AnomaliesPanel from '@/features/dac7/components/Dac7AnomaliesPanel.vue'

const U1 = '7a2e4b1c-0000-4a00-8000-0000000000a1'
const REFUND = {
  travelerId: U1, displayName: 'Awa Diop', source: 'PAYMENT', sourceId: 'p1', currency: 'XOF', amount: 25000, amountEur: 38.12,
  operationPaidAt: '2026-03-10T10:00:00Z', operationYear: 2026, refundedAt: '2026-03-12T10:00:00Z', refundYear: 2026,
  beforeRelease: true, refundDateEstimated: true,
}
const ANOMALY = { type: 'EXCHANGE_RATE_MISSING', travelerId: U1, displayName: 'Awa Diop', source: 'PAYMENT', sourceId: 'p2', currency: 'GNF', day: '2026-05-04' }
const norm = (t: string) => t.replace(/\s/g, ' ')
const stub = { NuxtLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' } }

beforeEach(() => {
  vi.clearAllMocks()
  seedAuth('ADMIN')
  svc.refunds.mockResolvedValue([REFUND])
  svc.anomalies.mockResolvedValue([ANOMALY])
})

describe('Dac7RefundsPanel', () => {
  const mountIt = async () => {
    const w = mount(Dac7RefundsPanel, { props: { year: 2026 }, global: { stubs: stub } })
    await flushPromises()
    return w
  }

  it('liste les remboursements à réconcilier de l’année', async () => {
    const w = await mountIt()
    expect(svc.refunds).toHaveBeenCalledWith(2026)
    const row = norm(w.get('[data-test="dac7-refund-row"]').text())
    expect(row).toContain('Awa Diop')
    expect(row).toContain('Paiement')
    expect(row).toContain('25000 XOF')
    expect(row).toContain('38,12 €')
    expect(row).toMatch(/avant le versement/i)
    expect(row).toMatch(/date estimée/i)
    expect(w.get('[data-test="dac7-refund-open-' + U1 + '"]').attributes('data-to')).toBe(`/users/${U1}`)
  })

  it('explique qu’aucun remboursement n’est déduit automatiquement', async () => {
    const w = await mountIt()
    expect(w.get('[data-test="dac7-refunds-panel"]').text()).toMatch(/jamais déduit/i)
  })

  it('montant en euros inconnu : tiret, pas de NaN', async () => {
    svc.refunds.mockResolvedValue([{ ...REFUND, amountEur: null, displayName: null, beforeRelease: false, refundDateEstimated: false }])
    const w = await mountIt()
    const row = w.get('[data-test="dac7-refund-row"]').text()
    expect(row).toContain('n/d')
    expect(row).not.toMatch(/[–—]/)
    expect(row).toContain('Nom non renseigné')
    expect(row).not.toContain('NaN')
    expect(row).not.toMatch(/avant le versement/i)
  })

  it('année rechargée quand elle change', async () => {
    const w = await mountIt()
    await w.setProps({ year: 2025 })
    await flushPromises()
    expect(svc.refunds).toHaveBeenLastCalledWith(2025)
  })

  it('course : la réponse en retard de l’ancienne année est ignorée, et ses lignes disparaissent au changement', async () => {
    const late: { resolve: (_v: unknown) => void }[] = []
    svc.refunds.mockReset()
    svc.refunds.mockImplementation(() => new Promise((resolve) => { late.push({ resolve }) }))
    const w = mount(Dac7RefundsPanel, { props: { year: 2026 }, global: { stubs: stub } })
    await flushPromises()
    late[0].resolve([{ ...REFUND, displayName: 'Ancienne 2026' }])
    await flushPromises()
    expect(w.text()).toContain('Ancienne 2026')
    await w.setProps({ year: 2025 })
    await flushPromises()
    expect(w.text()).not.toContain('Ancienne 2026')
    expect(w.text()).toContain('Chargement')
    await w.setProps({ year: 2024 })
    await flushPromises()
    late[2].resolve([{ ...REFUND, displayName: 'Année 2024' }])
    await flushPromises()
    late[1].resolve([{ ...REFUND, displayName: 'Année 2025 tardive' }])
    await flushPromises()
    expect(w.text()).toContain('Année 2024')
    expect(w.text()).not.toContain('Année 2025 tardive')
    expect(w.text()).not.toContain('Chargement')
  })

  it('une erreur vide l’ancienne liste au lieu de la laisser sous le message', async () => {
    const w = await mountIt()
    expect(w.findAll('[data-test="dac7-refund-row"]')).toHaveLength(1)
    svc.refunds.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Panne' } })
    await w.setProps({ year: 2025 })
    await flushPromises()
    expect(w.findAll('[data-test="dac7-refund-row"]')).toHaveLength(0)
    expect(w.get('[data-test="state-error"]').text()).toContain('Panne')
  })

  it('vide, erreur avec « Réessayer », ancien back', async () => {
    svc.refunds.mockResolvedValueOnce([])
    const w = await mountIt()
    expect(w.get('[data-test="dac7-refunds-empty"]').text()).toContain('Aucun remboursement')
    svc.refunds.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Panne' } })
    const w2 = await mountIt()
    expect(w2.get('[data-test="state-error"]').text()).toContain('Panne')
    svc.refunds.mockResolvedValueOnce([REFUND])
    await w2.get('[data-test="state-retry"]').trigger('click')
    await flushPromises()
    expect(w2.findAll('[data-test="dac7-refund-row"]')).toHaveLength(1)
    svc.refunds.mockRejectedValueOnce({ statusCode: 404, data: {} })
    const w3 = await mountIt()
    expect(w3.get('[data-test="dac7-unavailable"]').text()).toContain('Non disponible sur cette version du serveur')
    expect(w3.find('[data-test="state-error"]').exists()).toBe(false)
  })
})

describe('Dac7AnomaliesPanel', () => {
  const mountIt = async () => {
    const w = mount(Dac7AnomaliesPanel, { props: { year: 2026 }, global: { stubs: stub } })
    await flushPromises()
    return w
  }

  it('liste les anomalies avec leur explication française', async () => {
    const w = await mountIt()
    expect(svc.anomalies).toHaveBeenCalledWith(2026)
    const row = w.get('[data-test="dac7-anomaly-row"]').text()
    expect(row).toContain('Taux de change inconnu')
    expect(row).toContain('Awa Diop')
    expect(row).toContain('GNF')
    expect(row).toContain('Paiement')
    expect(row).toContain('04/05/2026')
    expect(w.get('[data-test="dac7-anomaly-open-' + U1 + '"]').attributes('data-to')).toBe(`/users/${U1}`)
  })

  it('sans USER_VIEW, pas de lien vers la fiche', async () => {
    seedAuth('SUPPORT', { USER_VIEW: false, DAC7_REPORT: true })
    const w = await mountIt()
    expect(w.find('[data-test="dac7-anomaly-open-' + U1 + '"]').exists()).toBe(false)
  })

  it('champs absents : pas de « undefined »', async () => {
    svc.anomalies.mockResolvedValue([{}])
    const w = await mountIt()
    expect(w.text()).not.toContain('undefined')
    expect(w.get('[data-test="dac7-anomaly-row"]').text()).toContain('Anomalie')
  })

  it('vide, erreur, ancien back', async () => {
    svc.anomalies.mockResolvedValueOnce([])
    const w = await mountIt()
    expect(w.get('[data-test="dac7-anomalies-empty"]').text()).toContain('Aucune anomalie')
    svc.anomalies.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Panne' } })
    const w2 = await mountIt()
    expect(w2.get('[data-test="state-error"]').text()).toContain('Panne')
    svc.anomalies.mockRejectedValueOnce({ statusCode: 405, data: {} })
    const w3 = await mountIt()
    expect(w3.find('[data-test="dac7-unavailable"]').exists()).toBe(true)
  })

  it('année rechargée quand elle change', async () => {
    const w = await mountIt()
    await w.setProps({ year: 2025 })
    await flushPromises()
    expect(svc.anomalies).toHaveBeenLastCalledWith(2025)
  })
})
