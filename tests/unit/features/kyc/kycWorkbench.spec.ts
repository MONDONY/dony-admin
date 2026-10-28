import { describe, it, expect } from 'vitest'
import {
  defaultKycUserId, groupKycQueue, kycDisplayName, kycQueueOrder, kycSituation, neighbourKycUserId, summarizeKycQueue,
} from '@/features/kyc/lib/kycWorkbench'
import type { AdminKycQueueItem } from '@/features/kyc/types/index'

const row = (userId: string, waitingHours: number | null, extra: Partial<AdminKycQueueItem> = {}): AdminKycQueueItem => ({
  userId, userName: `Nom ${userId}`, kycStatus: 'IN_REVIEW', waitingHours, ...extra,
})

describe('groupKycQueue', () => {
  it('À décider : en retard puis dans les temps, plus ancien en tête', () => {
    const groups = groupKycQueue([row('a', 5), row('b', 60), row('c', 30), row('d', 72)], 'IN_REVIEW')
    expect(groups.map((g) => [g.key, g.title, g.items.map((i) => i.userId)])).toEqual([
      ['OVERDUE', 'En retard', ['d', 'b']],
      ['ON_TIME', 'Dans les temps', ['c', 'a']],
    ])
  })

  it('une attente inconnue passe après les autres, dans les temps', () => {
    const groups = groupKycQueue([row('a', null), row('b', 2)], 'IN_REVIEW')
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((i) => i.userId)).toEqual(['b', 'a'])
  })

  it('un groupe vide est omis', () => {
    expect(groupKycQueue([row('a', 60)], 'IN_REVIEW').map((g) => g.key)).toEqual(['OVERDUE'])
  })

  it('les autres onglets : un seul groupe titré du nom de l’onglet, ordre du serveur', () => {
    const groups = groupKycQueue([row('b', 1), row('a', 99)], 'REJECTED')
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: 'ALL', title: 'Refusées' })
    expect(groups[0].items.map((i) => i.userId)).toEqual(['b', 'a'])
  })

  it('file vide : aucun groupe', () => {
    expect(groupKycQueue([], 'IN_REVIEW')).toEqual([])
  })
})

describe('ordre, voisin et dossier par défaut', () => {
  const order = kycQueueOrder(groupKycQueue([row('a', 5), row('b', 60), row('c', 30)], 'IN_REVIEW'))

  it('met les groupes bout à bout', () => {
    expect(order.map((i) => i.userId)).toEqual(['b', 'c', 'a'])
    expect(defaultKycUserId(order)).toBe('b')
    expect(defaultKycUserId([])).toBeNull()
  })

  it('J et K se déplacent et s’arrêtent aux bords', () => {
    expect(neighbourKycUserId(order, 'b', 1)).toBe('c')
    expect(neighbourKycUserId(order, 'c', -1)).toBe('b')
    expect(neighbourKycUserId(order, 'a', 1)).toBeNull()
    expect(neighbourKycUserId(order, 'b', -1)).toBeNull()
  })

  it('sans dossier ouvert ou hors file : J prend le premier, K le dernier', () => {
    expect(neighbourKycUserId(order, null, 1)).toBe('b')
    expect(neighbourKycUserId(order, 'zzz', -1)).toBe('a')
    expect(neighbourKycUserId([], null, 1)).toBeNull()
  })
})

describe('summarizeKycQueue', () => {
  it('compte les retards et trouve l’attente la plus longue', () => {
    const s = summarizeKycQueue([row('a', 5), row('b', 79, { userName: 'Moussa Traoré' }), row('c', 49), row('d', null)], 4)
    expect(s).toEqual({ total: 4, overdue: 2, longest: { label: '3 j 7 h', name: 'Moussa Traoré' }, partial: false })
  })

  it('page partielle : le total du serveur dépasse la page chargée', () => {
    expect(summarizeKycQueue([row('a', 1)], 12).partial).toBe(true)
  })

  it('aucune attente connue : pas de plus longue', () => {
    expect(summarizeKycQueue([row('a', null)], 1).longest).toBeNull()
    expect(summarizeKycQueue([], 0)).toEqual({ total: 0, overdue: 0, longest: null, partial: false })
  })
})

describe('kycDisplayName', () => {
  it('repli lisible sans nom', () => {
    expect(kycDisplayName({ userName: null })).toBe('Nom non renseigné')
    expect(kycDisplayName({ userName: '  ' })).toBe('Nom non renseigné')
    expect(kycDisplayName({ userName: ' Awa ' })).toBe('Awa')
  })
})

describe('kycSituation', () => {
  it('lit d’abord le statut de la file, puis celui du dossier', () => {
    expect(kycSituation('PENDING', 'VERIFIED', true)).toBe('VERIFIED')
    expect(kycSituation('REJECTED', null, true)).toBe('REJECTED')
    expect(kycSituation('VERIFIED', 'IN_REVIEW', true)).toBe('REVIEW')
  })

  it('sans session chez le fournisseur : rien à décider', () => {
    expect(kycSituation('PENDING', 'IN_PROGRESS', false)).toBe('NO_SESSION')
    expect(kycSituation('NOT_STARTED', null, false)).toBe('NO_SESSION')
  })

  it('session présente : revue manuelle ou autre', () => {
    expect(kycSituation('PENDING', 'IN_REVIEW', true)).toBe('REVIEW')
    expect(kycSituation('PENDING', null, true)).toBe('REVIEW')
    expect(kycSituation('NOT_STARTED', 'IN_PROGRESS', true)).toBe('OTHER')
    expect(kycSituation(undefined, undefined, true)).toBe('OTHER')
  })
})
