import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import { reasonViolationMessage } from '@/lib/restoreReason'

vi.mock('@/features/signalements/services/reportsService')
vi.mock('@/features/signalements/services/ratingsService')
import { reportsService } from '@/features/signalements/services/reportsService'
import { ratingsService } from '@/features/signalements/services/ratingsService'
import { useReports } from '@/features/signalements/composables/useReports'
import { useRatings } from '@/features/signalements/composables/useRatings'
import RatingsTable from '@/features/signalements/components/RatingsTable.vue'

const reports = reportsService as unknown as Record<string, ReturnType<typeof vi.fn>>
const ratings = ratingsService as unknown as Record<string, ReturnType<typeof vi.fn>>
const empty = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
const validation = (violations: unknown) => Object.assign(new Error('422'), {
  statusCode: 422, data: { status: 422, title: 'Bad Request', detail: 'Validation failed', violations },
})

describe('reasonViolationMessage (422 de validation standard, sans code)', () => {
  it('forme réelle du back : objet { champ: message }, clé reason prioritaire', () => {
    expect(reasonViolationMessage(validation({ note: 'autre', reason: 'la taille doit être comprise entre 10 et 500' })))
      .toBe('la taille doit être comprise entre 10 et 500')
  })
  it('objet sans clé reason : première valeur', () => {
    expect(reasonViolationMessage(validation({ motif: 'ne doit pas être vide' }))).toBe('ne doit pas être vide')
  })
  it('objet vide ou valeurs vides : repli FR', () => {
    expect(reasonViolationMessage(validation({}))).toBe('Motif refusé : il doit compter entre 10 et 500 caractères.')
    expect(reasonViolationMessage(validation({ reason: '  ' }))).toBe('Motif refusé : il doit compter entre 10 et 500 caractères.')
  })
  it('violations d’un type inattendu : pas une erreur de validation', () => {
    expect(reasonViolationMessage(validation('texte'))).toBeNull()
  })
  it('rend le message de la première violation (tableau toléré)', () => {
    expect(reasonViolationMessage(validation([{ field: 'reason', message: 'la taille doit être comprise entre 10 et 500' }])))
      .toBe('la taille doit être comprise entre 10 et 500')
  })
  it('accepte des violations en chaînes', () => {
    expect(reasonViolationMessage(validation(['motif trop court']))).toBe('motif trop court')
  })
  it('texte générique si la violation est muette', () => {
    expect(reasonViolationMessage(validation([{ field: 'reason' }]))).toBe('Motif refusé : il doit compter entre 10 et 500 caractères.')
    expect(reasonViolationMessage(validation([]))).toBe('Motif refusé : il doit compter entre 10 et 500 caractères.')
  })
  it('null pour un 422 métier (code) ou une autre erreur', () => {
    expect(reasonViolationMessage(Object.assign(new Error('422'), { statusCode: 422, data: { code: 'bulk-restore-too-many', violations: [] } }))).toBeNull()
    expect(reasonViolationMessage(Object.assign(new Error('409'), { statusCode: 409, data: {} }))).toBeNull()
    expect(reasonViolationMessage(Object.assign(new Error('422'), { statusCode: 422, data: {} }))).toBeNull()
  })
})

describe('useReports : contrat du back', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reports.list = vi.fn().mockResolvedValue(empty)
    reports.restore = vi.fn()
    reports.bulkRestore = vi.fn()
  })

  it('motif invalide (422 violations) : reasonError, pas d’erreur de liste, pas de relecture', async () => {
    reports.restore.mockRejectedValue(validation([{ field: 'reason', message: 'motif trop court' }]))
    const r = useReports()
    expect(await r.restoreOne('r1', 'court mais')).toBe(false)
    expect(r.reasonError.value).toBe('motif trop court')
    expect(r.error.value).toBeNull()
    expect(reports.list).not.toHaveBeenCalled()
  })

  it('un nouvel essai efface reasonError', async () => {
    reports.restore.mockRejectedValueOnce(validation([{ message: 'motif trop court' }])).mockResolvedValueOnce({ id: 'r1' })
    const r = useReports()
    await r.restoreOne('r1', 'court mais')
    await r.restoreOne('r1', 'motif enfin assez long')
    expect(r.reasonError.value).toBeNull()
  })

  it('422 bulk-restore-too-many : detail conservé', async () => {
    reports.list.mockResolvedValue({ ...empty, content: [{ id: 'a', deletedAt: '2026-09-20T10:00:00Z' }], totalElements: 1 })
    reports.bulkRestore.mockRejectedValue(Object.assign(new Error('422'), {
      statusCode: 422, data: { code: 'bulk-restore-too-many', detail: '100 signalements au plus par restauration groupée.' },
    }))
    const r = useReports()
    await r.setDeletedFilter(true)
    r.toggleSelect('a')
    expect(await r.restoreSelected()).toBeNull()
    expect(r.error.value).toBe('100 signalements au plus par restauration groupée.')
  })
})

describe('useRatings : contrat du back', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ratings.list = vi.fn().mockResolvedValue(empty)
    ratings.restore = vi.fn()
  })

  it('409 rating-superseded : message clair, avis marqué non restaurable', async () => {
    ratings.restore.mockRejectedValue(Object.assign(new Error('409'), { statusCode: 409, data: { code: 'rating-superseded', detail: 'superseded' } }))
    const r = useRatings()
    expect(await r.restore('rt1', 'avis légitime finalement')).toBe(false)
    expect(r.error.value).toBe('L’auteur a noté de nouveau cette livraison depuis : cet avis ne peut plus être restauré.')
    expect(r.supersededIds.value).toEqual(['rt1'])
  })

  it('motif invalide : reasonError, liste intacte', async () => {
    ratings.restore.mockRejectedValue(validation([{ message: 'motif trop long' }]))
    const r = useRatings()
    expect(await r.restore('rt1', 'x'.repeat(20))).toBe(false)
    expect(r.reasonError.value).toBe('motif trop long')
    expect(r.error.value).toBeNull()
    expect(ratings.list).not.toHaveBeenCalled()
  })
})

describe('RatingsTable : avis supplanté', () => {
  beforeEach(() => seedAuth('ADMIN'))
  it('pas de bouton Restaurer pour un avis supplanté', () => {
    const rating = {
      id: 'rt1', bidId: 'b1', raterName: 'Awa', ratedName: 'Karim', score: 1, comment: 'x', flagged: false,
      excluded: false, excludedReason: null, createdAt: '2026-06-01T10:00:00Z', deletedAt: '2026-09-20T10:00:00Z',
    }
    const w = mount(RatingsTable, { props: { ratings: [rating], loading: false, nonRestorableIds: ['rt1'] } })
    expect(w.find('[data-test="restore-rating-rt1"]').exists()).toBe(false)
  })
})
