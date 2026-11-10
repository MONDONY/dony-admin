import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

const svc = vi.hoisted(() => ({ list: vi.fn(), dismiss: vi.fn() }))
vi.mock('@/features/individual-frequency/services/individualFrequencyService', () => ({ individualFrequencyService: svc }))

import IndividualFrequencyQueue from '@/features/individual-frequency/components/IndividualFrequencyQueue.vue'

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const F1 = { flagId: 'f1', userId: '7a2e4b1c-0000-4a00-8000-0000000000a1', displayName: 'Awa Diop', tripsCount: 5, windowDays: 30, threshold: 4, detectedAt: day(2) }
const F2 = { flagId: 'f2', userId: '7a2e4b1c-0000-4a00-8000-0000000000a2', displayName: null, tripsCount: 9, windowDays: 30, threshold: 4, detectedAt: day(6) }

async function mountQueue(role: 'ADMIN' | 'SUPPORT' = 'ADMIN', overrides: Record<string, boolean> = {}) {
  seedAuth(role, overrides)
  const w = mount(IndividualFrequencyQueue, {
    global: { stubs: { NuxtLink: { props: ['to'], template: '<a :data-to="typeof to === \'string\' ? to : to.path"><slot /></a>' } } },
  })
  await flushPromises()
  return w
}

describe('IndividualFrequencyQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list.mockResolvedValue([F1, F2])
    svc.dismiss.mockResolvedValue(undefined)
  })

  it('liste les particuliers à confirmer, le plus ancien d’abord, avec le compte et la fiche', async () => {
    const w = await mountQueue()
    expect(svc.list).toHaveBeenCalledTimes(1)
    expect(w.get('[data-test="individual-frequency-count"]').text()).toBe('2')
    const rows = w.findAll('[data-test^="individual-frequency-row-"]')
    expect(rows.map((r) => r.attributes('data-test'))).toEqual(['individual-frequency-row-f2', 'individual-frequency-row-f1'])
    const first = w.get('[data-test="individual-frequency-row-f1"]').text()
    expect(first).toContain('Awa Diop')
    expect(first).toContain('5 trajets avec colis sur 30 jours (seuil : 4). Statut déclaré : Particulier.')
    expect(w.get('[data-test="individual-frequency-row-f2"]').text()).toContain('Nom non renseigné')
    expect(w.get(`[data-test="individual-frequency-open-${F1.userId}"]`).attributes('data-to')).toBe(`/users/${F1.userId}`)
  })

  it('dit clairement qu’aucune sanction n’est automatique', async () => {
    const w = await mountQueue()
    expect(w.get('[data-test="individual-frequency-queue"]').text()).toContain('Aucun blocage automatique')
  })

  it('liste vide : état vide, pas d’erreur', async () => {
    svc.list.mockResolvedValue([])
    const w = await mountQueue()
    expect(w.get('[data-test="individual-frequency-empty"]').text()).toContain('Aucun particulier à confirmer')
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
  })

  it('ancien back (404) : section absente, aucune erreur', async () => {
    svc.list.mockRejectedValue({ statusCode: 404, data: {} })
    const w = await mountQueue()
    expect(w.find('[data-test="individual-frequency-queue"]').exists()).toBe(false)
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
    expect(w.text()).toBe('')
  })

  it('vraie erreur : message avec « Réessayer », qui relit', async () => {
    svc.list.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Base indisponible' } })
    const w = await mountQueue()
    expect(w.get('[data-test="state-error"]').text()).toContain('Base indisponible')
    svc.list.mockResolvedValueOnce([F1])
    await w.get('[data-test="state-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="state-error"]').exists()).toBe(false)
    expect(w.findAll('[data-test^="individual-frequency-row-"]')).toHaveLength(1)
  })

  it('« Écarter » demande une confirmation, puis poste et relit la liste', async () => {
    const w = await mountQueue()
    await w.get('[data-test="individual-frequency-dismiss-f1"]').trigger('click')
    expect(svc.dismiss).not.toHaveBeenCalled()
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    svc.list.mockResolvedValueOnce([F2])
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.dismiss).toHaveBeenCalledWith('f1')
    expect(svc.list).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="individual-frequency-row-f1"]').exists()).toBe(false)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('annuler la confirmation n’écarte rien', async () => {
    const w = await mountQueue()
    await w.get('[data-test="individual-frequency-dismiss-f1"]').trigger('click')
    await w.get('[data-test="cancel"]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(svc.dismiss).not.toHaveBeenCalled()
  })

  it('échec de l’écartement : le message reste visible et la liste est conservée', async () => {
    svc.dismiss.mockRejectedValue({ statusCode: 500, data: { detail: 'Panne' } })
    const w = await mountQueue()
    await w.get('[data-test="individual-frequency-dismiss-f1"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="individual-frequency-error"]').text()).toBe('Panne')
    expect(w.find('[data-test="individual-frequency-row-f1"]').exists()).toBe(true)
  })

  it('ligne avec demande hebdomadaire sous le seuil : phrase GP Pro à la place des trajets', async () => {
    svc.list.mockResolvedValue([{ ...F1, tripsCount: 2, weeklyApplication: true }])
    const w = await mountQueue()
    const t = w.get('[data-test="individual-frequency-row-f1"]').text()
    expect(t).toContain('A demandé GP Pro, fréquence : chaque semaine. Statut déclaré : Particulier.')
    expect(t).not.toContain('trajets avec colis')
  })

  it('alerte déjà close ailleurs (404 au POST) : la liste est relue, aucune erreur', async () => {
    svc.dismiss.mockRejectedValue({ statusCode: 404, data: { code: 'individual-frequency-flag-not-found' } })
    const w = await mountQueue()
    svc.list.mockResolvedValueOnce([F2])
    await w.get('[data-test="individual-frequency-dismiss-f1"]').trigger('click')
    await w.get('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.list).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="individual-frequency-row-f1"]').exists()).toBe(false)
    expect(w.find('[data-test="individual-frequency-error"]').exists()).toBe(false)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('sans GP_PRO_REVIEW : la liste se lit, aucun bouton « Écarter »', async () => {
    const w = await mountQueue('ADMIN', { GP_PRO_REVIEW: false })
    expect(w.find('[data-test="individual-frequency-row-f1"]').exists()).toBe(true)
    expect(w.find('[data-test="individual-frequency-dismiss-f1"]').exists()).toBe(false)
  })

  it('un identifiant d’utilisateur qui n’est pas un UUID ne produit pas de lien', async () => {
    svc.list.mockResolvedValue([{ ...F1, userId: '../x' }])
    const w = await mountQueue()
    expect(w.find('[data-test="individual-frequency-open-../x"]').exists()).toBe(false)
  })
})
