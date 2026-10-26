import { describe, it, expect } from 'vitest'
import type { AdminPermission } from '@/stores/auth'
import {
  averageEffect,
  averageEffectText,
  buildRatingTimeline,
  defaultRatingId,
  distributionBars,
  followingRatingId,
  formatAverage,
  isDestructiveRatingAction,
  isRatingReasonRequired,
  neighbourRatingId,
  ratingActionConsequence,
  ratingActions,
  ratingReasonError,
  raterHabit,
  sameRelationText,
} from '@/features/signalements/ratingWorkbench'
import type { AdminRating } from '@/features/signalements/types/index'

const all = (_p: AdminPermission) => true
const only = (...allowed: AdminPermission[]) => (p: AdminPermission) => allowed.includes(p)

function rating(id: string, extra: Partial<AdminRating> = {}): AdminRating {
  return {
    id, bidId: 'b1', raterName: 'Awa Diallo', ratedName: 'Moussa Ba', score: 1, comment: 'nul',
    flagged: false, excluded: false, excludedReason: null, createdAt: '2026-10-20T10:00:00Z', ...extra,
  }
}

describe('ratingActions : gestes possibles selon l’état et les permissions', () => {
  it('avis actif : exclure puis supprimer', () => {
    expect(ratingActions(rating('a'), { can: all })).toEqual(['EXCLUDE', 'DELETE'])
  })

  it('avis exclu : réintégrer puis supprimer', () => {
    expect(ratingActions(rating('a', { excluded: true }), { can: all })).toEqual(['REINTEGRATE', 'DELETE'])
  })

  it('avis supprimé : seulement restaurer', () => {
    expect(ratingActions(rating('a', { deletedAt: '2026-10-21T00:00:00Z' }), { can: all })).toEqual(['RESTORE'])
  })

  it('chaque geste respecte sa permission', () => {
    expect(ratingActions(rating('a'), { can: only('RATING_MODERATE') })).toEqual(['EXCLUDE'])
    expect(ratingActions(rating('a'), { can: only('RATING_DELETE') })).toEqual(['DELETE'])
    expect(ratingActions(rating('a'), { can: only() })).toEqual([])
    expect(ratingActions(rating('a', { deletedAt: 'x' }), { can: only('RATING_MODERATE') })).toEqual([])
  })

  it('restauration indisponible (ancien back) ou avis supplanté : plus de geste', () => {
    const deleted = rating('a', { deletedAt: '2026-10-21T00:00:00Z' })
    expect(ratingActions(deleted, { can: all, restoreUnavailable: true })).toEqual([])
    expect(ratingActions(deleted, { can: all, superseded: true })).toEqual([])
  })
})

describe('motifs', () => {
  it('obligatoire sauf pour une réintégration', () => {
    expect(isRatingReasonRequired('EXCLUDE')).toBe(true)
    expect(isRatingReasonRequired('DELETE')).toBe(true)
    expect(isRatingReasonRequired('RESTORE')).toBe(true)
    expect(isRatingReasonRequired('REINTEGRATE')).toBe(false)
  })

  it('exclure et supprimer : non vide, 500 caractères au plus', () => {
    expect(ratingReasonError('EXCLUDE', '  ')).toBe('Le motif est obligatoire.')
    expect(ratingReasonError('DELETE', '')).toBe('Le motif est obligatoire.')
    expect(ratingReasonError('EXCLUDE', 'insultes')).toBeNull()
    expect(ratingReasonError('DELETE', 'x'.repeat(501))).toBe('Au plus 500 caractères.')
    expect(ratingReasonError('DELETE', 'x'.repeat(500))).toBeNull()
  })

  it('restaurer : entre 10 et 500 caractères, journalisé', () => {
    expect(ratingReasonError('RESTORE', 'trop court')).toBeNull() // 10 caractères pile
    expect(ratingReasonError('RESTORE', 'court')).toContain('Entre 10 et 500 caractères')
    expect(ratingReasonError('RESTORE', 'x'.repeat(501))).toContain('Entre 10 et 500 caractères')
  })

  it('réintégrer : facultatif, mais pas plus de 500 caractères', () => {
    expect(ratingReasonError('REINTEGRATE', '')).toBeNull()
    expect(ratingReasonError('REINTEGRATE', 'x'.repeat(501))).toBe('Au plus 500 caractères.')
  })

  it('seule la suppression est destructive, avec sa conséquence nommée', () => {
    expect(isDestructiveRatingAction('DELETE')).toBe(true)
    expect(isDestructiveRatingAction('EXCLUDE')).toBe(false)
    expect(ratingActionConsequence('DELETE', 'Moussa Ba')).toContain('profil de Moussa Ba')
    expect(ratingActionConsequence('DELETE', null)).toContain('la personne notée')
    expect(ratingActionConsequence('EXCLUDE', 'Moussa Ba')).toBeNull()
  })
})

describe('averageEffect : ce que le geste ferait de la moyenne', () => {
  const rated = { averageRating: 4.0, ratingCount: 5 }

  it('exclure ou supprimer un avis compté le retire de la moyenne', () => {
    const e = averageEffect('EXCLUDE', rating('a', { score: 1 }), rated)!
    expect(e.before).toBe(4)
    expect(e.after).toBeCloseTo(4.75) // (4×5 − 1) / 4
    expect(e.countAfter).toBe(4)
    expect(averageEffect('DELETE', rating('a', { score: 1 }), rated)!.after).toBeCloseTo(4.75)
  })

  it('réintégrer l’y remet', () => {
    const e = averageEffect('REINTEGRATE', rating('a', { score: 1, excluded: true }), rated)!
    expect(e.after).toBeCloseTo(3.5) // (4×5 + 1) / 6
    expect(e.countAfter).toBe(6)
  })

  it('restaurer un avis supprimé l’y remet, sauf s’il est aussi exclu', () => {
    const deleted = rating('a', { score: 2, deletedAt: '2026-10-21T00:00:00Z' })
    expect(averageEffect('RESTORE', deleted, rated)!.after).toBeCloseTo(3.667, 2)
    expect(averageEffect('RESTORE', { ...deleted, excluded: true }, rated)).toBeNull()
  })

  it('un avis déjà hors moyenne n’est pas retiré une seconde fois', () => {
    expect(averageEffect('EXCLUDE', rating('a', { excluded: true }), rated)).toBeNull()
    expect(averageEffect('DELETE', rating('a', { deletedAt: 'x' }), rated)).toBeNull()
  })

  it('dernier avis compté : plus aucune moyenne', () => {
    expect(averageEffect('EXCLUDE', rating('a'), { averageRating: 1, ratingCount: 1 })).toEqual({ before: 1, after: null, countAfter: 0 })
  })

  it('aucun avis compté jusque-là : la moyenne devient cette note', () => {
    expect(averageEffect('REINTEGRATE', rating('a', { score: 3, excluded: true }), { averageRating: null, ratingCount: 0 }))
      .toEqual({ before: null, after: 3, countAfter: 1 })
  })

  it('personne notée inconnue : pas d’effet à montrer', () => {
    expect(averageEffect('EXCLUDE', rating('a'), null)).toBeNull()
    expect(averageEffect('EXCLUDE', rating('a'), undefined)).toBeNull()
  })

  it('moyenne absente avec un compte non nul : retrait sans moyenne', () => {
    expect(averageEffect('EXCLUDE', rating('a'), { averageRating: null, ratingCount: 3 }))
      .toEqual({ before: null, after: null, countAfter: 2 })
  })

  it('textes : une décimale, virgule française', () => {
    expect(formatAverage(4.75)).toBe('4,8')
    expect(averageEffectText({ before: 4, after: 4.75, countAfter: 4 }, 'Moussa Ba')).toBe('Moyenne de Moussa Ba : 4,0 → 4,8 (4 avis)')
    expect(averageEffectText({ before: null, after: null, countAfter: 0 }, null)).toBe('Moyenne de la personne notée : aucune → aucune (0 avis)')
  })
})

describe('repères sur le notant', () => {
  it('note presque toujours bas : au moins 5 notes et 60 % de notes basses', () => {
    expect(raterHabit({ ratingsGiven: 10, lowRatingsGiven: 6 })).toEqual({ label: 'Note presque toujours bas', tone: 'warning' })
    expect(raterHabit({ ratingsGiven: 10, lowRatingsGiven: 5 })).toBeNull()
  })
  it('trop peu de notes : aucun repère', () => {
    expect(raterHabit({ ratingsGiven: 4, lowRatingsGiven: 4 })).toBeNull()
  })

  it('plusieurs notes du même compte au même compte', () => {
    expect(sameRelationText(1, 'Awa', 'Moussa')).toBeNull()
    expect(sameRelationText(0, 'Awa', 'Moussa')).toBeNull()
    expect(sameRelationText(3, 'Awa', 'Moussa')).toBe('3 notes de Awa à Moussa')
    expect(sameRelationText(2, null, null)).toBe('2 notes de ce compte à cette personne')
  })
})

describe('distributionBars', () => {
  it('de 5 étoiles à 1, hauteurs relatives à la plus grande', () => {
    expect(distributionBars({ '5': 12, '4': 6, '1': 3 })).toEqual([
      { stars: 5, count: 12, ratio: 1 },
      { stars: 4, count: 6, ratio: 0.5 },
      { stars: 3, count: 0, ratio: 0 },
      { stars: 2, count: 0, ratio: 0 },
      { stars: 1, count: 3, ratio: 0.25 },
    ])
  })
  it('sans répartition : cinq barres vides', () => {
    expect(distributionBars(null).map((b) => b.ratio)).toEqual([0, 0, 0, 0, 0])
    expect(distributionBars(undefined)).toHaveLength(5)
  })
})

describe('sélection', () => {
  const list = [rating('a', { excluded: true }), rating('b', { flagged: true }), rating('c'), rating('d', { flagged: true, deletedAt: 'x' })]

  it('par défaut : le premier avis signalé encore à traiter, sinon le premier', () => {
    expect(defaultRatingId(list)).toBe('b')
    expect(defaultRatingId([rating('a'), rating('b')])).toBe('a')
    expect(defaultRatingId([])).toBeNull()
  })

  it('après un geste : le suivant, sinon le précédent', () => {
    expect(followingRatingId(list, 'b')).toBe('c')
    expect(followingRatingId(list, 'd')).toBe('c')
    expect(followingRatingId([rating('a')], 'a')).toBeNull()
    expect(followingRatingId(list, 'zzz')).toBeNull()
  })

  it('J / K : voisin sans boucler', () => {
    expect(neighbourRatingId(list, 'b', 1)).toBe('c')
    expect(neighbourRatingId(list, 'b', -1)).toBe('a')
    expect(neighbourRatingId(list, 'd', 1)).toBe('d')
    expect(neighbourRatingId(list, 'a', -1)).toBe('a')
    expect(neighbourRatingId(list, null, 1)).toBe('a')
    expect(neighbourRatingId([], null, 1)).toBeNull()
  })
})

describe('buildRatingTimeline', () => {
  const r = { id: 'rt1', createdAt: '2026-10-20T10:00:00Z', raterName: 'Awa Diallo' }

  it('sans trace de création : la date de l’avis ouvre la chronologie', () => {
    const items = buildRatingTimeline(r, [
      { action: 'RATING_DELETED', at: '2026-10-22T09:00:00Z', actorEmail: 'sira@yadony.com', note: 'insultes' },
      { action: 'RATING_EXCLUDED', detail: 'REINTEGRATED', at: '2026-10-21T09:00:00Z', actorEmail: 'sira@yadony.com' },
      { action: 'RATING_EXCLUDED', at: '2026-10-20T12:00:00Z', actorEmail: 'sira@yadony.com', note: 'doute' },
    ])
    expect(items.map((i) => i.label)).toEqual([
      'Avis laissé', 'Avis exclu de la moyenne', 'Avis réintégré dans la moyenne', 'Avis supprimé',
    ])
    expect(items[0]).toMatchObject({ by: 'par Awa Diallo', at: '2026-10-20T10:00:00Z' })
    expect(items[1]).toMatchObject({ by: 'par sira@yadony.com', note: 'doute' })
  })

  it('avec une trace de création : pas de doublon', () => {
    for (const action of ['RATING_CREATED', 'RECIPIENT_RATING_CREATED', 'TRAVELER_RATING_CREATED', 'RECEPTION_RATING_CREATED']) {
      const items = buildRatingTimeline(r, [{ action, at: '2026-10-20T10:00:00Z' }])
      expect(items).toHaveLength(1)
      expect(items[0]!.label).toMatch(/^Avis laissé/)
    }
  })

  it('restauration, alerte de fraude, code inconnu', () => {
    const items = buildRatingTimeline(r, [
      { action: 'AUTRE_CODE' }, { action: 'FRAUD_ALERT_RATING_FARMING' }, { action: 'RATING_RESTORED' },
    ])
    expect(items.map((i) => i.label)).toEqual(['Avis laissé', 'Avis restauré', 'Alerte fraude : notes en série', 'AUTRE_CODE'])
  })

  it('notant anonyme : pas de « par »', () => {
    expect(buildRatingTimeline({ ...r, raterName: null }, [])[0]!.by).toBeNull()
    expect(buildRatingTimeline(r, undefined)).toHaveLength(1)
  })
})
