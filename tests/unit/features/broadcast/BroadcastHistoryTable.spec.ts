import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BroadcastHistoryTable from '@/features/broadcast/components/BroadcastHistoryTable.vue'
import type { AdminBroadcast } from '@/features/broadcast/types/index'

const BROADCASTS: AdminBroadcast[] = [
  {
    id: 'b1', title: 'Maintenance', body: 'Le service sera coupé.', targetType: 'ALL',
    targetOrigin: null, targetDestination: null, targetUserId: null,
    recipientCount: 4200, adminId: 'a1', createdAt: '2026-08-10T09:00:00',
  },
  {
    id: 'b2', title: 'Nouveau corridor', body: 'Paris → Dakar disponible.', targetType: 'CORRIDOR',
    targetOrigin: 'Paris', targetDestination: 'Dakar', targetUserId: null,
    recipientCount: 58, adminId: 'a1', createdAt: '2026-08-12T14:30:00',
  },
]

describe('BroadcastHistoryTable', () => {
  it('affiche une ligne par envoi, avec titre, cible lisible, compteur et date', () => {
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: BROADCASTS, loading: false } })
    expect(w.find('[data-test="broadcast-row-b1"]').exists()).toBe(true)
    expect(w.text()).toContain('Maintenance')
    expect(w.text()).toContain('Tous les comptes actifs')
    expect(w.text()).toContain('4200')
    expect(w.text()).toContain('10/08/2026')
  })

  it('précise le corridor pour une cible CORRIDOR', () => {
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: BROADCASTS, loading: false } })
    expect(w.find('[data-test="broadcast-row-b2"]').text()).toContain('Paris → Dakar')
  })

  it('affiche un état vide explicite', () => {
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: [], loading: false } })
    expect(w.find('[data-test="broadcast-history-empty"]').exists()).toBe(true)
  })

  it('affiche un état de chargement', () => {
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: [], loading: true } })
    expect(w.text()).toContain('Chargement')
    expect(w.find('[data-test="broadcast-history-empty"]').exists()).toBe(false)
  })

  it('historique_ligneRule_afficheNomDuSegment', () => {
    const rows: AdminBroadcast[] = [{
      id: 'b3', title: 'Pro', body: 'x', targetType: 'RULE', targetOrigin: null, targetDestination: null, targetUserId: null,
      recipientCount: 12, adminId: 'a1', createdAt: '2026-11-01T09:00:00',
      audienceRule: { op: 'AND', children: [{ field: 'is_pro', operator: 'IS', value: true }] }, segmentId: 's1', segmentName: 'Comptes Pro',
    }]
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: rows, loading: false } })
    expect(w.find('[data-test="broadcast-row-b3"]').text()).toContain('Comptes Pro')
  })

  it('une règle à la volée affiche son nombre de conditions, sous-groupes compris', () => {
    const rule = { op: 'AND', children: [{ field: 'a', operator: 'EVER', value: null }, { op: 'OR', children: [{ field: 'b', operator: 'EVER', value: null }, { field: 'c', operator: 'EVER', value: null }] }] }
    const rows: AdminBroadcast[] = [{
      id: 'b4', title: 'x', body: 'x', targetType: 'RULE', targetOrigin: null, targetDestination: null, targetUserId: null,
      recipientCount: 3, adminId: 'a1', createdAt: '2026-11-01T09:00:00', audienceRule: rule, segmentId: null, segmentName: null,
    }]
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: rows, loading: false } })
    expect(w.find('[data-test="broadcast-row-b4"]').text()).toContain('Règle (3 conditions)')
  })

  it('une règle à une condition est au singulier, une règle vide vise tous les comptes, une règle absente reste générique', () => {
    const base = { title: 'x', body: 'x', targetType: 'RULE' as const, targetOrigin: null, targetDestination: null, targetUserId: null, recipientCount: 1, adminId: 'a1', createdAt: '2026-11-01T09:00:00' }
    const rows: AdminBroadcast[] = [
      { ...base, id: 'r1', audienceRule: { op: 'AND', children: [{ field: 'a', operator: 'EVER', value: null }] } },
      { ...base, id: 'r2', audienceRule: { op: 'AND', children: [] } },
      { ...base, id: 'r3', audienceRule: null },
    ]
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: rows, loading: false } })
    expect(w.find('[data-test="broadcast-row-r1"]').text()).toContain('Règle (1 condition)')
    expect(w.find('[data-test="broadcast-row-r2"]').text()).toContain('Règle (tous les comptes actifs)')
    expect(w.find('[data-test="broadcast-row-r3"]').text()).toContain('Audience sur mesure')
  })

  it('historique_ancienneLigne_libelleInchange', () => {
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: BROADCASTS, loading: false } })
    expect(w.find('[data-test="broadcast-row-b1"]').text()).toContain('Tous les comptes actifs')
    expect(w.find('[data-test="broadcast-row-b1"]').text()).not.toContain('Règle')
  })

  it('une cible USER affiche l’identifiant', () => {
    const rows: AdminBroadcast[] = [{ ...BROADCASTS[0]!, id: 'u1', targetType: 'USER', targetUserId: 'abc' }]
    const w = mount(BroadcastHistoryTable, { props: { broadcasts: rows, loading: false } })
    expect(w.find('[data-test="broadcast-row-u1"]').text()).toContain('abc')
  })
})
