import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingQueue from '@/features/signalements/components/RatingQueue.vue'
import type { AdminRating } from '@/features/signalements/types/index'

const NOW = new Date('2026-10-26T12:00:00Z').getTime()
const rating: AdminRating = {
  id: 'rt1', bidId: 'b1', raterName: 'Awa', ratedName: 'Karim', score: 1, comment: 'arnaqueur',
  flagged: true, excluded: false, excludedReason: null, createdAt: '2026-10-26T09:00:00Z',
}
const mountQueue = (ratings: AdminRating[], extra: Record<string, unknown> = {}) =>
  mount(RatingQueue, { props: { ratings, loading: false, now: NOW, ...extra } })

describe('RatingQueue', () => {
  it('une ligne par avis : note, commentaire, noms et ancienneté', () => {
    const w = mountQueue([rating])
    const row = w.find('[data-test="rating-row-rt1"]')
    expect(row.text()).toContain('arnaqueur')
    expect(row.text()).toContain('Awa → Karim')
    expect(row.text()).toContain('il y a 3 h')
    expect(row.find('[role="img"]').attributes('aria-label')).toBe('1 étoile sur 5')
    expect(row.text()).toContain('★☆☆☆☆')
  })

  it('« étoiles » au pluriel à partir de 2', () => {
    expect(mountQueue([{ ...rating, score: 4 }]).find('[role="img"]').attributes('aria-label')).toBe('4 étoiles sur 5')
  })

  it('un avis signalé porte son badge', () => {
    expect(mountQueue([rating]).find('[data-test="flagged-rt1"]').text()).toBe('Signalé')
    expect(mountQueue([{ ...rating, flagged: false }]).find('[data-test="flagged-rt1"]').exists()).toBe(false)
  })

  it('avis exclu : commentaire barré et badge ; supprimé : badge seul, grisé', () => {
    const excluded = mountQueue([{ ...rating, excluded: true }])
    expect(excluded.text()).toContain('Exclu')
    expect(excluded.find('[data-test="rating-row-rt1"] span.line-through').exists()).toBe(true)
    const deleted = mountQueue([{ ...rating, excluded: true, deletedAt: '2026-10-20T10:00:00Z' }])
    expect(deleted.text()).toContain('Supprimé')
    expect(deleted.text()).not.toContain('Exclu')
    expect(deleted.find('[data-test="rating-open-rt1"]').classes()).toContain('text-text-muted')
  })

  it('champs manquants : libellés de repli, sans tiret cadratin', () => {
    const w = mountQueue([{ ...rating, flagged: false, comment: null, raterName: null, ratedName: null }])
    const text = w.find('[data-test="rating-row-rt1"]').text()
    expect(text).toContain('Sans commentaire')
    expect(text).toContain('Anonyme → Compte supprimé')
    expect(text).not.toContain('—')
  })

  it('l’avis ouvert est marqué ; un clic émet select', async () => {
    const w = mountQueue([rating, { ...rating, id: 'rt2' }], { selectedId: 'rt2' })
    expect(w.find('[data-test="rating-open-rt2"]').attributes('aria-current')).toBe('true')
    expect(w.find('[data-test="rating-row-rt2"]').attributes('data-selected')).toBe('true')
    expect(w.find('[data-test="rating-open-rt1"]').attributes('aria-current')).toBeUndefined()
    await w.find('[data-test="rating-open-rt1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['rt1'])
  })

  it('état vide et chargement', () => {
    expect(mountQueue([]).text()).toMatch(/Aucun avis/i)
    expect(mountQueue([], { loading: true }).text()).toMatch(/Chargement/i)
  })
})
