import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PackageRequestsTable from '@/features/package-requests/components/PackageRequestsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'
import { formatMajorAmount } from '@/features/finance/types/index'

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id, senderId: 's1', senderName: 'Awa Ndiaye', departureCity: 'Paris', arrivalCity: 'Dakar', desiredDate: '2026-10-01',
  weightKg: 4, parcelSize: 'SMALL', transportMode: 'PLANE', status: 'OPEN', currency: 'EUR', targetPrice: 40,
  createdAt: '2026-09-20T10:00:00Z', reportCount: 0, openNegotiationCount: 1, ...over,
})

describe('PackageRequestsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('affiche le trajet, l’expéditeur, le prix dans sa devise et le statut en français', () => {
    const w = mount(PackageRequestsTable, { props: { requests: [item('p1', { currency: 'XOF', targetPrice: 20000 })], loading: false } })
    const row = w.find('[data-test="pr-row-p1"]')
    expect(row.text()).toContain('Paris → Dakar')
    expect(row.text()).toContain('Awa Ndiaye')
    expect(row.text()).toContain(formatMajorAmount(20000, 'XOF'))
    expect(row.text()).toContain('Ouverte')
    expect(row.text()).toContain('01/10/2026')
  })

  it('prix et date absents : libellés explicites, jamais de tiret cadratin', () => {
    const w = mount(PackageRequestsTable, {
      props: { requests: [item('p1', { targetPrice: null, desiredDate: null, senderName: null, weightKg: null })], loading: false },
    })
    const text = w.find('[data-test="pr-row-p1"]').text()
    expect(text).toContain('À négocier')
    expect(text).toContain('Date flexible')
    expect(text).toContain('Expéditeur inconnu')
    expect(text).not.toContain('—')
  })

  it('badge du nombre de signalements, seulement s’il y en a', () => {
    const w = mount(PackageRequestsTable, { props: { requests: [item('p1', { reportCount: 3 }), item('p2')], loading: false } })
    expect(w.find('[data-test="pr-reports-p1"]').text()).toBe('3 signalements')
    expect(w.find('[data-test="pr-reports-p2"]').exists()).toBe(false)
    const one = mount(PackageRequestsTable, { props: { requests: [item('p3', { reportCount: 1 })], loading: false } })
    expect(one.find('[data-test="pr-reports-p3"]').text()).toBe('1 signalement')
  })

  it('badge « Retirée » sur une demande retirée ; statut inconnu brut', () => {
    const w = mount(PackageRequestsTable, {
      props: { requests: [item('p1', { status: 'REMOVED_BY_ADMIN' }), item('p2', { status: 'ARCHIVED' })], loading: false },
    })
    expect(w.find('[data-test="pr-row-p1"] .bg-danger\\/15').text()).toBe('Retirée')
    expect(w.find('[data-test="pr-row-p2"]').text()).toContain('ARCHIVED')
  })

  it('la colonne du prix s’appelle « Budget net »', () => {
    const w = mount(PackageRequestsTable, { props: { requests: [], loading: false } })
    expect(w.find('thead').text()).toContain('Budget net')
    expect(w.find('thead').text()).not.toContain('Prix visé')
  })

  it('clic sur une ligne : émet select', async () => {
    const w = mount(PackageRequestsTable, { props: { requests: [item('p1')], loading: false } })
    await w.find('[data-test="pr-row-p1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['p1'])
  })

  it('clavier : Entrée ouvre aussi la fiche', async () => {
    const w = mount(PackageRequestsTable, { props: { requests: [item('p1')], loading: false } })
    await w.find('[data-test="pr-row-p1"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select')![0]).toEqual(['p1'])
  })

  it('états chargement et vide', () => {
    expect(mount(PackageRequestsTable, { props: { requests: [], loading: true } }).text()).toContain('Chargement…')
    const empty = mount(PackageRequestsTable, { props: { requests: [], loading: false } })
    expect(empty.text()).toContain('Aucune demande d’envoi')
  })

  it('colonne Mode : libellé, Peu importe pour une demande sans mode, vide si le champ manque', () => {
    const noKey = item('p3'); delete (noKey as Record<string, unknown>).transportMode
    const w = mount(PackageRequestsTable, {
      props: { requests: [item('p1', { transportMode: 'BOAT' }), item('p2', { transportMode: null }), noKey, item('p4', { transportMode: 'BUS' })], loading: false },
    })
    expect(w.get('[data-test="pr-mode-p1"]').text()).toBe('Bateau')
    expect(w.get('[data-test="pr-mode-p2"]').text()).toBe('Peu importe')
    expect(w.get('[data-test="pr-mode-p3"]').text()).toBe('')
    expect(w.find('[data-test="pr-mode-p3"] svg').exists()).toBe(false)
    expect(w.get('[data-test="pr-mode-p4"]').text()).toBe('Route')
  })

  it('poids tolérant et dimensions ou volume quand le back les envoie', () => {
    const w = mount(PackageRequestsTable, {
      props: { requests: [
        item('p1', { weightKg: null, lengthCm: 120, widthCm: 80, heightCm: 60, volumeM3: 0.576 }),
        item('p2', { volumeM3: 12.5 }),
        item('p3'),
      ], loading: false },
    })
    expect(w.get('[data-test="pr-weight-p1"]').text()).toContain('Non renseigné')
    expect(w.get('[data-test="pr-size-p1"]').text()).toBe('120 × 80 × 60 cm · 0,576 m³')
    expect(w.get('[data-test="pr-size-p2"]').text()).toBe('12,5 m³')
    expect(w.get('[data-test="pr-weight-p2"]').text()).toContain('4 kg')
    expect(w.find('[data-test="pr-size-p3"]').exists()).toBe(false)
    expect(w.get('[data-test="pr-weight-p3"]').text()).not.toContain('null')
  })
})
