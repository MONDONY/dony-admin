import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({ list: vi.fn(), dismiss: vi.fn() }))
vi.mock('@/features/individual-frequency/services/individualFrequencyService', () => ({ individualFrequencyService: svc }))

import { useIndividualFrequencyFlags } from '@/features/individual-frequency/composables/useIndividualFrequencyFlags'
import { useIndividualFrequencyDismiss } from '@/features/individual-frequency/composables/useIndividualFrequencyDismiss'

describe('useIndividualFrequencyFlags', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('charge la liste', async () => {
    svc.list.mockResolvedValue([{ flagId: 'f1', userId: 'u1' }])
    const l = useIndividualFrequencyFlags()
    await l.load()
    expect(l.items.value).toEqual([{ flagId: 'f1', userId: 'u1' }])
    expect(l.error.value).toBeNull()
    expect(l.unavailable.value).toBe(false)
    expect(l.isLoading.value).toBe(false)
  })

  it('ancien back (404 sans code) : liste vide, indisponible, aucune erreur', async () => {
    svc.list.mockRejectedValue({ statusCode: 404, data: {} })
    const l = useIndividualFrequencyFlags()
    await l.load()
    expect(l.items.value).toEqual([])
    expect(l.unavailable.value).toBe(true)
    expect(l.error.value).toBeNull()
  })

  it('405 : même tolérance', async () => {
    svc.list.mockRejectedValue({ statusCode: 405 })
    const l = useIndividualFrequencyFlags()
    await l.load()
    expect(l.unavailable.value).toBe(true)
    expect(l.error.value).toBeNull()
  })

  it('vraie erreur : message (detail du ProblemDetail ou repli), liste conservée', async () => {
    svc.list.mockResolvedValueOnce([{ flagId: 'f1', userId: 'u1' }])
    const l = useIndividualFrequencyFlags()
    await l.load()
    svc.list.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Base indisponible' } })
    await l.load()
    expect(l.error.value).toBe('Base indisponible')
    expect(l.items.value).toHaveLength(1)
    svc.list.mockRejectedValueOnce(new Error(''))
    await l.load()
    expect(l.error.value).toBe('Impossible de charger les particuliers à confirmer')
  })

  it('une relecture réussie après une indisponibilité la lève', async () => {
    svc.list.mockRejectedValueOnce({ statusCode: 404 })
    const l = useIndividualFrequencyFlags()
    await l.load()
    svc.list.mockResolvedValueOnce([])
    await l.load()
    expect(l.unavailable.value).toBe(false)
  })
})

describe('useIndividualFrequencyDismiss', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('succès : true, pas d’erreur', async () => {
    svc.dismiss.mockResolvedValue(undefined)
    const d = useIndividualFrequencyDismiss()
    expect(await d.run('f1')).toBe(true)
    expect(svc.dismiss).toHaveBeenCalledWith('f1')
    expect(d.error.value).toBeNull()
    expect(d.busy.value).toBe(false)
  })

  it('endpoint absent : indisponible, aucune erreur affichée', async () => {
    svc.dismiss.mockRejectedValue({ statusCode: 404 })
    const d = useIndividualFrequencyDismiss()
    expect(await d.run('f1')).toBe(false)
    expect(d.unavailable.value).toBe(true)
    expect(d.error.value).toBeNull()
  })

  it('alerte inconnue (404 avec code) : message, et l’écran relit', async () => {
    svc.dismiss.mockRejectedValue({ statusCode: 404, data: { code: 'individual-frequency-flag-not-found' } })
    const onStale = vi.fn()
    const d = useIndividualFrequencyDismiss({ onStale })
    expect(await d.run('f1')).toBe(false)
    expect(d.error.value).toBe('Alerte introuvable : la liste a été relue.')
    expect(d.unavailable.value).toBe(false)
    expect(onStale).toHaveBeenCalledTimes(1)
  })

  it('autre erreur : detail du serveur, sinon repli', async () => {
    svc.dismiss.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Panne' } })
    const d = useIndividualFrequencyDismiss()
    expect(await d.run('f1')).toBe(false)
    expect(d.error.value).toBe('Panne')
    svc.dismiss.mockRejectedValueOnce(new Error(''))
    await d.run('f1')
    expect(d.error.value).toBe('L’alerte n’a pas pu être écartée')
    d.clearError()
    expect(d.error.value).toBeNull()
  })
})
