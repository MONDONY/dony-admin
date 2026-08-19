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
})
