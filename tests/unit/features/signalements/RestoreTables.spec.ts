import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingsTable from '@/features/signalements/components/RatingsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

const deletedRating = {
  id: 'rt1', bidId: 'b1', raterName: 'Awa', ratedName: 'Karim', score: 1, comment: 'arnaqueur',
  flagged: false, excluded: false, excludedReason: null, createdAt: '2026-06-01T10:00:00Z',
  deletedAt: '2026-09-20T10:00:00Z', deletedByAdminEmail: 'mod@yadony.com', deleteReason: 'insulte',
}

describe('RatingsTable : avis supprimé', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('montre qui, quand et le motif, et un bouton Restaurer', async () => {
    const w = mount(RatingsTable, { props: { ratings: [deletedRating], loading: false } })
    const info = w.find('[data-test="rating-deleted-info-rt1"]')
    expect(info.text()).toContain('mod@yadony.com')
    expect(info.text()).toContain('20/09/2026')
    expect(info.text()).toContain('insulte')
    expect(w.find('[data-test="exclude-rt1"]').exists()).toBe(false)
    expect(w.find('[data-test="remove-rt1"]').exists()).toBe(false)
    await w.find('[data-test="restore-rating-rt1"]').trigger('click')
    expect(w.emitted('restore')![0]).toEqual(['rt1'])
  })

  it('sans motif ni auteur, reste lisible', () => {
    const w = mount(RatingsTable, {
      props: { ratings: [{ ...deletedRating, deletedByAdminEmail: undefined, deleteReason: undefined }], loading: false },
    })
    expect(w.find('[data-test="rating-deleted-info-rt1"]').text()).toContain('Supprimé le')
    expect(w.find('[data-test="rating-deleted-info-rt1"]').text()).not.toContain('Motif')
  })

  it('masque Restaurer quand l’endpoint est indisponible ou sans RATING_DELETE', () => {
    const w = mount(RatingsTable, { props: { ratings: [deletedRating], loading: false, restoreUnavailable: true } })
    expect(w.find('[data-test="restore-rating-rt1"]').exists()).toBe(false)
    seedAuth('SUPPORT')
    const s = mount(RatingsTable, { props: { ratings: [deletedRating], loading: false } })
    expect(s.find('[data-test="restore-rating-rt1"]').exists()).toBe(false)
  })

  it('un avis exclu affiche son motif sans tiret cadratin', () => {
    const w = mount(RatingsTable, {
      props: { ratings: [{ ...deletedRating, deletedAt: undefined, excluded: true, excludedReason: 'diffamatoire' }], loading: false },
    })
    expect(w.text()).toContain('diffamatoire')
    expect(w.find('[data-test="rating-row-rt1"]').text()).not.toMatch(/Exclu —/)
  })
})
