import { describe, it, expect } from 'vitest'
import { visibleTabs, type CanFn } from '@/features/user-profile/lib/userProfileTabs'
import { ALL_PERMISSIONS } from '@/stores/auth'
import { seedAuth } from '~/tests/helpers/auth'

const ids = (can: CanFn) => visibleTabs(can).map(t => t.id)

describe('visibleTabs', () => {
  it('ADMIN voit tout, dans l’ordre de la maquette', () => {
    const auth = seedAuth('ADMIN')
    expect(ids(p => auth.can(p))).toEqual(['overview', 'parcels', 'money', 'incidents', 'identity', 'support', 'manage'])
  })
  it('SUPPORT voit tout sauf Gestion', () => {
    const auth = seedAuth('SUPPORT')
    expect(ids(p => auth.can(p))).toEqual(['overview', 'parcels', 'money', 'incidents', 'identity', 'support'])
  })
  it('aucune permission : seulement la vue d’ensemble', () => {
    expect(ids(() => false)).toEqual(['overview'])
  })
  it('libellés', () => {
    expect(visibleTabs(() => true).map(t => t.label)).toEqual([
      'Vue d’ensemble', 'Colis, trajets et demandes', 'Argent', 'Incidents et signalements',
      'Identité (KYC)', 'Support et journal', 'Gestion',
    ])
  })
  it.each([
    ['REPORT_VIEW', 'incidents'], ['DISPUTE_VIEW', 'incidents'], ['AUDIT_VIEW', 'support'],
    ['SUPPORT_TICKET_VIEW', 'support'], ['WALLET_ADJUST', 'manage'], ['USER_DELETE', 'manage'],
    ['USER_MESSAGE_MUTE', 'manage'], ['USER_COMMISSION', 'manage'], ['USER_PRO_GRANT', 'manage'],
    ['GP_PRO_REVIEW', 'manage'], ['ADMIN_MANAGE', 'manage'],
  ] as const)('%s seule ouvre %s', (perm, tab) => {
    expect(ALL_PERMISSIONS).toContain(perm)
    expect(ids(p => p === perm)).toContain(tab)
  })
})
