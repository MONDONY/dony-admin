import { describe, it, expect } from 'vitest'
import {
  ageLabel, applicantName, attentionPoints, neighbourKey, sortApplications, sortReview, summarizeGpPro,
} from '@/features/gp-pro/lib/gpProWorkbench'

const NOW = Date.parse('2026-10-28T12:00:00Z')
const app = (applicationId: string, createdAt?: string | null, extra: Record<string, unknown> = {}) =>
  ({ applicationId, userId: `u-${applicationId}`, createdAt, ...extra }) as never

describe('tri des files', () => {
  it('demandes : les plus anciennes d’abord, sans date à la fin', () => {
    const sorted = sortApplications([
      app('b', '2026-10-27T12:00:00Z'), app('none'), app('a', '2026-10-20T12:00:00Z'), app('bad', 'pas une date'), app('c', '2026-10-28T08:00:00Z'),
    ])
    expect(sorted.map((r) => r.applicationId)).toEqual(['a', 'b', 'c', 'none', 'bad'])
  })

  it('titulaires à revoir : date de détection, même règle', () => {
    const sorted = sortReview([
      { userId: 'x', detectedAt: '2026-10-26T00:00:00Z' }, { userId: 'y' }, { userId: 'z', detectedAt: '2026-10-22T00:00:00Z' },
    ])
    expect(sorted.map((r) => r.userId)).toEqual(['z', 'x', 'y'])
  })

  it('ne modifie pas la liste d’origine', () => {
    const items = [app('b', '2026-10-27T12:00:00Z'), app('a', '2026-10-20T12:00:00Z')]
    sortApplications(items)
    expect(items.map((r) => r.applicationId)).toEqual(['b', 'a'])
  })
})

describe('ageLabel', () => {
  it('heures, jours et moins d’une heure', () => {
    expect(ageLabel('2026-10-28T11:40:00Z', NOW)).toBe('< 1 h')
    expect(ageLabel('2026-10-28T07:00:00Z', NOW)).toBe('5 h')
    expect(ageLabel('2026-10-23T12:00:00Z', NOW)).toBe('5 j')
  })

  it('une date future compte comme zéro ; sans date exploitable : rien', () => {
    expect(ageLabel('2026-10-30T12:00:00Z', NOW)).toBe('< 1 h')
    expect(ageLabel(null, NOW)).toBeNull()
    expect(ageLabel(undefined, NOW)).toBeNull()
    expect(ageLabel('n’importe quoi', NOW)).toBeNull()
  })
})

describe('neighbourKey', () => {
  const keys = ['a', 'b', 'c']
  it('J et K se déplacent et s’arrêtent aux bords', () => {
    expect(neighbourKey(keys, 'a', 1)).toBe('b')
    expect(neighbourKey(keys, 'c', -1)).toBe('b')
    expect(neighbourKey(keys, 'c', 1)).toBeNull()
    expect(neighbourKey(keys, 'a', -1)).toBeNull()
  })

  it('sans dossier ouvert ou hors file : J prend le premier, K le dernier', () => {
    expect(neighbourKey(keys, null, 1)).toBe('a')
    expect(neighbourKey(keys, 'zzz', -1)).toBe('c')
    expect(neighbourKey([], null, 1)).toBeNull()
  })
})

describe('summarizeGpPro', () => {
  it('total serveur, plus ancienne demande et titulaires à revoir', () => {
    const s = summarizeGpPro(
      [app('b', '2026-10-27T12:00:00Z', { displayName: 'Fatou' }), app('a', '2026-10-23T12:00:00Z', { displayName: 'Moussa' })], 4, 3, NOW,
    )
    expect(s).toEqual({ applications: 4, review: 3, oldest: { label: '5 j', name: 'Moussa' } })
  })

  it('aucune date exploitable : pas de plus ancienne', () => {
    expect(summarizeGpPro([app('a')], 1, 0, NOW).oldest).toBeNull()
    expect(summarizeGpPro([], 0, 0, NOW)).toEqual({ applications: 0, review: 0, oldest: null })
  })
})

describe('applicantName', () => {
  it('repli lisible', () => {
    expect(applicantName({ displayName: null })).toBe('Nom non renseigné')
    expect(applicantName({})).toBe('Nom non renseigné')
    expect(applicantName({ displayName: ' Awa ' })).toBe('Awa')
  })
})

describe('attentionPoints', () => {
  const OK = { kycStatus: 'VERIFIED', openDisputes: 0, openReports: 0, averageRating: 4.8, publishedTrips: 9 }

  it('profil sain : aucun point', () => {
    expect(attentionPoints(OK)).toEqual([])
    expect(attentionPoints({ kycStatus: 'VERIFIED' })).toEqual([])
    expect(attentionPoints({ ...OK, averageRating: null })).toEqual([])
    expect(attentionPoints({ ...OK, averageRating: 4 })).toEqual([])
  })

  it('identité non vérifiée ou inconnue', () => {
    expect(attentionPoints({ ...OK, kycStatus: 'REJECTED' }).map((p) => p.key)).toEqual(['kyc'])
    expect(attentionPoints({ ...OK, kycStatus: undefined }).map((p) => p.key)).toEqual(['kyc'])
  })

  it('litiges et signalements ouverts, au singulier et au pluriel', () => {
    const one = attentionPoints({ ...OK, openDisputes: 1, openReports: 1 })
    expect(one.map((p) => p.label)).toEqual(['1 litige ouvert sur son compte.', '1 signalement ouvert sur son compte.'])
    const many = attentionPoints({ ...OK, openDisputes: 3, openReports: 2 })
    expect(many.map((p) => p.label)).toEqual(['3 litiges ouverts sur son compte.', '2 signalements ouverts sur son compte.'])
  })

  it('note sous 4/5 avec virgule française ; aucun trajet publié', () => {
    const points = attentionPoints({ ...OK, averageRating: 3.64, publishedTrips: 0 })
    expect(points.map((p) => p.key)).toEqual(['rating', 'trips'])
    expect(points[0].label).toBe('Note moyenne 3,6 / 5, sous 4/5.')
  })
})
