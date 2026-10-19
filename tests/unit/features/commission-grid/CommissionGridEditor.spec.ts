import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const svc = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: svc }))

import CommissionGridEditor from '@/features/commission-grid/components/CommissionGridEditor.vue'
import { COMPARISON_DEBOUNCE_MS } from '@/features/commission-grid/composables/useDraftComparison'
import { GRID, httpError, row, simulation } from './fixtures'

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

function mountEditor(props: Record<string, unknown> = {}) {
  return mount(CommissionGridEditor, { props: { initial: GRID, ...props } })
}
async function settle() {
  await vi.advanceTimersByTimeAsync(COMPARISON_DEBOUNCE_MS)
  await flushPromises()
}

describe('CommissionGridEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    svc.simulate.mockResolvedValue(simulation([row(20, 1.4, 1.6), row(5, 1, 1, true)]))
  })
  afterEach(() => { vi.useRealTimers() })

  it('pré-remplit avec la grille en vigueur ; la première borne est figée', () => {
    const w = mountEditor()
    expect((w.find('[data-test="tier-from-0"]').element as HTMLInputElement).value).toBe('0')
    expect(w.find('[data-test="tier-from-0"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="tier-remove-0"]').attributes('disabled')).toBeDefined()
    expect((w.find('[data-test="tier-rate-1"]').element as HTMLInputElement).value).toBe('6')
    expect((w.find('[data-test="minimum-XOF"]').element as HTMLInputElement).value).toBe('650')
  })

  it('sans grille en vigueur : 7 / 6 / 5 %', () => {
    const w = mountEditor({ initial: null })
    expect(['0', '1', '2'].map(i => (w.find(`[data-test="tier-rate-${i}"]`).element as HTMLInputElement).value)).toEqual(['7', '6', '5'])
  })

  it('ajoute et supprime des tranches, 10 au plus', async () => {
    const w = mountEditor()
    await w.find('[data-test="tier-add"]').trigger('click')
    expect(w.findAll('[data-test^="tier-row-"]')).toHaveLength(4)
    expect((w.find('[data-test="tier-from-3"]').element as HTMLInputElement).value).toBe('400')
    expect((w.find('[data-test="tier-rate-3"]').element as HTMLInputElement).value).toBe('5')
    await w.find('[data-test="tier-remove-1"]').trigger('click')
    expect(w.findAll('[data-test^="tier-row-"]')).toHaveLength(3)
    expect((w.find('[data-test="tier-from-1"]').element as HTMLInputElement).value).toBe('300')
    // La première tranche ne part pas, même si le bouton était cliqué.
    await w.find('[data-test="tier-remove-0"]').trigger('click')
    expect(w.findAll('[data-test^="tier-row-"]')).toHaveLength(3)
    for (let i = 0; i < 10; i++) await w.find('[data-test="tier-add"]').trigger('click')
    expect(w.findAll('[data-test^="tier-row-"]')).toHaveLength(10)
    expect(w.find('[data-test="tier-add"]').attributes('disabled')).toBeDefined()
  })

  it('tableau comparatif en direct : actuelle, nouvelle, écart, minimum, équivalent FCFA', async () => {
    const w = mountEditor()
    await settle()
    const rows = w.findAll('[data-test="comparison-row"]')
    expect(rows).toHaveLength(2)
    const first = plain(rows[0]!.text())
    expect(first).toContain('20,00 €')
    expect(first).toContain('≈ 13 119 F CFA')
    expect(first).toContain('1,40 €')
    expect(first).toContain('1,60 €')
    expect(first).toContain('+0,20 €')
    expect(rows[1]!.text()).toContain('(minimum)')
  })

  it('la saisie relance la comparaison, avec les nouveaux taux', async () => {
    const w = mountEditor()
    await settle()
    await w.find('[data-test="tier-rate-0"]').setValue('8')
    await settle()
    expect(svc.simulate).toHaveBeenCalledTimes(2)
    expect(svc.simulate.mock.calls[1]![0].draft.tiers[0].rate).toBe(0.08)
  })

  it('erreurs 422 affichées en face de chaque champ, les autres en tête', async () => {
    svc.simulate.mockRejectedValue(httpError(422, {
      code: 'validation',
      violations: {
        'tiers[1].fromEur': 'Les bornes doivent être strictement croissantes.',
        'minimums.XOF': 'Le minimum ne peut pas dépasser l’équivalent de 5 €.',
        note: 'Trop longue', tiers: 'De 1 à 10', effectiveFrom: 'Dans le passé', draft: 'Autre problème',
      },
    }))
    const w = mountEditor()
    await settle()
    expect(w.find('[data-test="error-tiers[1].fromEur"]').text()).toContain('strictement croissantes')
    expect(w.find('[data-test="error-minimums.XOF"]').text()).toContain('5 €')
    expect(w.find('[data-test="error-note"]').text()).toBe('Trop longue')
    expect(w.find('[data-test="error-tiers"]').text()).toBe('De 1 à 10')
    expect(w.find('[data-test="error-effectiveFrom"]').text()).toBe('Dans le passé')
    expect(w.find('[data-test="editor-other-errors"]').text()).toBe('Autre problème')
    expect(w.text()).toContain('Corrigez la grille')
  })

  it('date d’effet : libellé Paris, bouton Immédiat qui la vide', async () => {
    const w = mountEditor()
    expect(w.find('[data-test="effective-label"]').text()).toContain('dès la confirmation')
    await w.find('[data-test="effective-from"]').setValue('2026-11-01T00:00')
    expect(w.find('[data-test="effective-label"]').text()).toContain('le 1er novembre 2026 à 00:00 (heure de Paris)')
    await w.find('[data-test="effective-now"]').trigger('click')
    expect(w.find('[data-test="effective-label"]').text()).toContain('dès la confirmation')
  })

  it('confirmation simple sans hausse, puis programmation sans acquittement', async () => {
    svc.schedule.mockResolvedValue(GRID)
    const w = mountEditor({ hasScheduled: true })
    await w.find('[data-test="note"]').setValue('Baisse de rentrée')
    await w.find('[data-test="editor-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="overlay"]').exists()).toBe(true)
    expect(w.text()).toContain('remplace la grille déjà programmée')
    expect(w.find('[data-test="confirmation-input"]').exists()).toBe(false)
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    const body = svc.schedule.mock.calls[0]![0]
    expect(body.acknowledgedWarnings).toEqual([])
    expect(body.note).toBe('Baisse de rentrée')
    expect(w.emitted('scheduled')?.[0]).toEqual([GRID])
  })

  it('hausse dans les 30 jours : message, phrase « HAUSSE SANS PRÉAVIS », puis acquittement', async () => {
    svc.simulate.mockResolvedValue(simulation([row(20, 1.4, 1.6)], ['INCREASE_WITHIN_30_DAYS']))
    svc.schedule.mockResolvedValue(GRID)
    const w = mountEditor()
    await settle()
    expect(w.find('[data-test="comparison-increase"]').exists()).toBe(true)
    await w.find('[data-test="editor-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="confirm-increase"]').exists()).toBe(true)
    expect(w.text()).not.toContain('remplace la grille déjà programmée')
    expect(w.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="confirmation-input"]').setValue('HAUSSE SANS PRÉAVIS')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.schedule.mock.calls[0]![0].acknowledgedWarnings).toEqual(['INCREASE_WITHIN_30_DAYS'])
    expect(w.emitted('scheduled')).toHaveLength(1)
  })

  it('le back exige un acquittement inattendu : la confirmation renforcée revient', async () => {
    svc.simulate.mockResolvedValue(simulation([]))
    svc.schedule
      .mockRejectedValueOnce(httpError(422, { code: 'commission-grid-warning-not-acknowledged', warnings: ['INCREASE_WITHIN_30_DAYS'] }))
      .mockResolvedValueOnce(GRID)
    const w = mountEditor()
    await w.find('[data-test="editor-submit"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="confirm-increase"]').exists()).toBe(true)
    await w.find('[data-test="confirmation-input"]').setValue('HAUSSE SANS PRÉAVIS')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.schedule.mock.calls[1]![0].acknowledgedWarnings).toEqual(['INCREASE_WITHIN_30_DAYS'])
    expect(w.emitted('scheduled')).toHaveLength(1)
  })

  it('brouillon invalide à la vérification : pas de confirmation ; erreur d’envoi affichée puis effacée à la saisie', async () => {
    svc.simulate.mockRejectedValueOnce(httpError(422, { violations: { 'tiers[0].rate': 'Taux invalide' } }))
    const w = mountEditor()
    await w.find('[data-test="editor-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    expect(w.find('[data-test="error-tiers[0].rate"]').text()).toBe('Taux invalide')

    svc.simulate.mockResolvedValue(simulation([]))
    svc.schedule.mockRejectedValueOnce(httpError(500, { detail: 'Panne serveur' }))
    await w.find('[data-test="editor-submit"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="editor-error"]').text()).toBe('Panne serveur')
    expect(w.emitted('scheduled')).toBeUndefined()
    await w.find('[data-test="tier-rate-0"]').setValue('6')
    expect(w.find('[data-test="editor-error"]').exists()).toBe(false)
  })

  it('Annuler ferme la confirmation sans rien poster ; Fermer émet close', async () => {
    svc.simulate.mockResolvedValue(simulation([]))
    const w = mountEditor()
    await w.find('[data-test="editor-submit"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    expect(svc.schedule).not.toHaveBeenCalled()
    await w.find('[data-test="editor-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('back sans l’endpoint : mention de mise à jour du serveur', async () => {
    svc.simulate.mockRejectedValue(httpError(404))
    const w = mountEditor()
    await settle()
    expect(w.find('[data-test="editor-unavailable"]').exists()).toBe(true)
  })

  it('erreur générale de comparaison', async () => {
    svc.simulate.mockRejectedValue(httpError(500, { detail: 'Calcul impossible' }))
    const w = mountEditor()
    await settle()
    expect(w.find('[data-test="comparison-error"]').text()).toBe('Calcul impossible')
  })
})
